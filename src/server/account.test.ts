import { createClient } from "@libsql/client";
import { beforeEach, expect, test } from "vitest";
import {
	checkPasswordReset,
	requestPasswordReset,
	resetPassword,
	sendVerification,
	verifyEmail,
} from "./account.server";
import {
	AuthError,
	authenticate,
	createSession,
	createUser,
	getSessionUser,
	type User,
	updateProfile,
} from "./auth.server";
import { createBoard, listMembers, listUnregistered } from "./boards.server";
import { clearOutbox, listOutbox } from "./mail/send.server";
import { migrate } from "./migrate";

let db: ReturnType<typeof createClient>;
let dag: User;
beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	dag = await createUser(db, {
		name: "Dag",
		email: "dag@example.se",
		password: "hemligt123",
	});
});

const t0 = new Date("2026-11-12T10:00:00Z");
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

/** The token in the newest email's link to `path`. */
async function linkToken(path: string) {
	const [mail] = await listOutbox(db);
	return new RegExp(`/${path}/([\\w-]+)`).exec(mail?.text ?? "")?.[1] ?? "";
}

test("confirming the address links boards that added it without an account", async () => {
	expect(dag.emailVerified).toBe(false);
	const anna = await createUser(db, {
		name: "Anna",
		email: "anna@example.se",
		password: "hemligt123",
	});
	const board = await createBoard(db, anna.id, "BRF Björken");
	// Dag was added without an account before registering. (Adding by email
	// now would find the account, so the row is made directly.)
	await db.execute({
		sql: "INSERT INTO board_unregistered_members (id, board_id, name, email, title) VALUES ('u1', ?, 'Dag Dagsson', 'dag@example.se', 'Kassör')",
		args: [board.id],
	});

	await sendVerification(db, dag, t0);
	const [mail] = await listOutbox(db);
	expect(mail).toMatchObject({
		to: "dag@example.se",
		subject: "Bekräfta din e-postadress",
	});
	const token = await linkToken("bekrafta");

	expect(await verifyEmail(db, "fel", t0)).toBeNull();
	expect(await verifyEmail(db, token, later(1))).toEqual({
		joinedBoards: ["BRF Björken"],
	});
	expect(await verifyEmail(db, token, later(2))).toBeNull();

	expect(
		(await authenticate(db, "dag@example.se", "hemligt123")).emailVerified,
	).toBe(true);
	expect(await listUnregistered(db, anna.id, board.id)).toEqual([]);
	expect(
		(await listMembers(db, anna.id, board.id)).find((m) => m.userId === dag.id),
	).toMatchObject({ role: "member", title: "Kassör" });

	// Nothing more to confirm.
	await clearOutbox(db);
	await sendVerification(db, { ...dag, emailVerified: true }, later(10));
	expect(await listOutbox(db)).toEqual([]);
});

test("at most one confirmation email a minute; links expire", async () => {
	await sendVerification(db, dag, t0);
	await sendVerification(db, dag, later(0.5));
	expect(await listOutbox(db)).toHaveLength(1);
	await sendVerification(db, dag, later(2));
	expect(await listOutbox(db)).toHaveLength(2);
	const token = await linkToken("bekrafta");
	expect(await verifyEmail(db, token, later(2 + 48 * 60))).toBeNull();
});

test("changing the address makes it unconfirmed, and old links stop working", async () => {
	await sendVerification(db, dag, t0);
	const token = await linkToken("bekrafta");
	const changed = await updateProfile(db, dag.id, {
		name: "Dag",
		email: "dag@nytt.se",
		currentPassword: "hemligt123",
	});
	expect(changed.emailVerified).toBe(false);
	expect(await verifyEmail(db, token, later(1))).toBeNull();

	await sendVerification(db, changed, later(2));
	expect((await listOutbox(db))[0].to).toBe("dag@nytt.se");
	expect(await verifyEmail(db, await linkToken("bekrafta"), later(3))).toEqual({
		joinedBoards: [],
	});
	// Saving only the name keeps it confirmed.
	expect(
		(
			await updateProfile(db, dag.id, {
				name: "Dag D",
				email: "dag@nytt.se",
				currentPassword: "",
			})
		).emailVerified,
	).toBe(true);
});

test("forgotten password: a link that works once, within the hour", async () => {
	await requestPasswordReset(db, "ingen@example.se", t0);
	expect(await listOutbox(db)).toEqual([]);

	await requestPasswordReset(db, " Dag@Example.se ", t0);
	await requestPasswordReset(db, "dag@example.se", later(0.5));
	const mails = await listOutbox(db);
	expect(mails).toHaveLength(1);
	expect(mails[0]).toMatchObject({
		to: "dag@example.se",
		subject: "Välj ett nytt lösenord",
	});
	const token = await linkToken("nytt-losenord");
	expect(await checkPasswordReset(db, token, later(59))).toBe(true);
	expect(await checkPasswordReset(db, token, later(60))).toBe(false);

	const session = await createSession(db, dag.id);
	await expect(resetPassword(db, token, "kort", later(5))).rejects.toThrow(
		AuthError,
	);
	// A too short password doesn't use up the link.
	expect(await checkPasswordReset(db, token, later(5))).toBe(true);
	expect(await resetPassword(db, token, "nyttlosen123", later(5))).toBe(dag.id);
	await expect(
		resetPassword(db, token, "nyttlosen123", later(6)),
	).rejects.toThrow(/fungerar inte längre/);

	// Logged out everywhere, the new password works, and the address is confirmed.
	expect(await getSessionUser(db, session.token)).toBeNull();
	await expect(
		authenticate(db, "dag@example.se", "hemligt123"),
	).rejects.toThrow(AuthError);
	expect(
		await authenticate(db, "dag@example.se", "nyttlosen123"),
	).toMatchObject({ id: dag.id, emailVerified: true });
});
