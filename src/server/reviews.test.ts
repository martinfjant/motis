import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAgenda, listTemplates } from "./agendas.server";
import { createUser } from "./auth.server";
import {
	addMember,
	addMemberByEmail,
	BoardError,
	createBoard,
	listUnregistered,
} from "./boards.server";
import { clearOutbox, listOutbox } from "./mail/send.server";
import { migrate } from "./migrate";
import {
	closeProtocol,
	createProtocol,
	getProtocol,
	saveItemValue,
} from "./protocols.server";
import {
	decideReview,
	getReviewPage,
	getReviewRound,
	isJusterat,
	sendForReview,
} from "./reviews.server";

let db: ReturnType<typeof createClient>;
let anna: string, bo: string, boardId: string, protocolId: string;
let dora: `unregistered:${string}`, eva: `unregistered:${string}`;
let itemId: (title: string) => string;

const mk = async (name: string) =>
	(
		await createUser(db, {
			name,
			email: `${name}@example.se`,
			password: "hemligt123",
		})
	).id;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-20T17:00:00Z"));
});
afterEach(() => {
	vi.useRealTimers();
});

beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	anna = await mk("anna");
	bo = await mk("bo");
	boardId = (await createBoard(db, anna, "BRF Björken")).id;
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	await addMember(db, anna, boardId, {
		name: "Dora",
		email: "dora@example.se",
		title: "",
	});
	await addMember(db, anna, boardId, { name: "Eva", email: "", title: "" });
	const people = await listUnregistered(db, anna, boardId);
	const ref = (name: string) =>
		`unregistered:${people.find((p) => p.name === name)?.id}` as const;
	dora = ref("Dora");
	eva = ref("Eva");

	const [tpl] = await listTemplates(db, anna, boardId);
	const agenda = await createAgenda(db, anna, boardId, {
		title: "Höstmöte",
		meetingAt: "2026-11-20T18:00",
		location: "Lokalen",
		templateId: tpl.id,
	});
	protocolId = (await createProtocol(db, anna, agenda.id)).id;
	const { items } = await getProtocol(db, anna, protocolId);
	itemId = (title) => items.find((i) => i.title === title)?.id ?? "";
	await saveItemValue(db, anna, itemId("Närvarande ledamöter"), {
		present: ["anna", "bo", "Dora", "Eva"],
	});
});

const choose = (...members: string[]) =>
	saveItemValue(db, anna, itemId("Val av justerare"), {
		done: true,
		reviewers: members.map((member) => ({
			name: "",
			member: member as `user:${string}`,
		})),
	});

/** The justering links in the outbox, by recipient. */
async function links() {
	const mails = await listOutbox(db);
	return Object.fromEntries(
		mails
			.filter((m) => m.subject.startsWith("Justera protokollet"))
			.map((m) => [m.to, /\/justera\/([\w-]+)/.exec(m.text)?.[1] ?? ""]),
	);
}

const refused = (p: Promise<unknown>, message?: RegExp) =>
	expect(p).rejects.toThrow(message ?? BoardError);

test("only a closed protocol with justerare who have email can be sent", async () => {
	await refused(sendForReview(db, bo, protocolId), /Stäng protokollet/);
	await closeProtocol(db, anna, protocolId);
	await refused(sendForReview(db, bo, protocolId), /Välj justerare/);

	// Choosing needs an open protocol or an editing session.
	const session = randomUUID();
	await saveItemValue(
		db,
		anna,
		itemId("Val av justerare"),
		{
			done: true,
			reviewers: [
				{ name: "", member: `user:${anna}` },
				{ name: "", member: eva },
			],
		},
		session,
	);
	await refused(sendForReview(db, bo, protocolId), /Eva saknar e-postadress/);
	expect(await listOutbox(db)).toEqual([]);
	expect(await getReviewRound(db, protocolId)).toBeNull();
});

test("justering round trip: decline, edit, send again, approve", async () => {
	await choose(`user:${anna}`, dora);
	await closeProtocol(db, anna, protocolId);
	await sendForReview(db, bo, protocolId);

	const first = await links();
	expect(Object.keys(first).sort()).toEqual([
		"anna@example.se",
		"dora@example.se",
	]);
	const [request] = await listOutbox(db);
	expect(request.subject).toBe(
		"Justera protokollet: Höstmöte 20-11-2026 18:00 – BRF Björken",
	);
	expect(request.text).toContain(
		"bo har skickat protokollet från BRF Björkens möte",
	);

	const round = await getReviewRound(db, protocolId);
	expect(round).toMatchObject({
		round: 1,
		sentByName: "bo",
		state: "pending",
		changed: false,
	});
	expect(round?.reviews.map((r) => [r.name, r.status])).toEqual([
		["anna", "pending"],
		["Dora", "pending"],
	]);

	// The justerare's page: the protocol, without who-is-who.
	const page = await getReviewPage(db, first["dora@example.se"]);
	expect(page).toMatchObject({
		board: { name: "BRF Björken" },
		protocol: { title: "Höstmöte" },
		review: { name: "Dora", status: "pending" },
		sentByName: "bo",
		replaced: false,
		changed: false,
		others: [{ name: "anna", status: "pending" }],
	});
	expect(
		page?.items.find((i) => i.type === "reviewers")?.value.reviewers,
	).toEqual([{ name: "anna" }, { name: "Dora" }]);
	expect(await getReviewPage(db, "fel")).toBeNull();

	// Anna approves; Dora declines, which needs a comment.
	await clearOutbox(db);
	await decideReview(db, first["anna@example.se"], {
		approve: true,
		comment: "",
	});
	await refused(
		decideReview(db, first["anna@example.se"], { approve: true, comment: "" }),
		/redan svarat/,
	);
	await refused(
		decideReview(db, first["dora@example.se"], {
			approve: false,
			comment: " ",
		}),
		/Skriv vad/,
	);
	await decideReview(db, first["dora@example.se"], {
		approve: false,
		comment: "Beloppet i punkt 8 saknas.",
	});
	expect(await getReviewRound(db, protocolId)).toMatchObject({
		state: "declined",
	});
	expect(await isJusterat(db, protocolId)).toBe(false);
	const [declined] = await listOutbox(db);
	expect(declined).toMatchObject({
		to: "bo@example.se",
		subject: "Protokollet avvisades: Höstmöte 20-11-2026 18:00 – BRF Björken",
	});
	expect(declined.text).toContain("Dora har avvisat protokollet");
	expect(declined.text).toContain("Beloppet i punkt 8 saknas.");

	// It can't go out again until it has been edited.
	await refused(sendForReview(db, bo, protocolId), /inte ändrats/);
	await saveItemValue(
		db,
		anna,
		itemId("Ekonomi"),
		{ done: true, notes: "Beloppet är 12 000 kr." },
		randomUUID(),
	);
	expect(await getReviewRound(db, protocolId)).toMatchObject({
		changed: true,
	});
	await clearOutbox(db);
	await sendForReview(db, anna, protocolId);
	const second = await links();

	// The old links now only say they have been replaced.
	expect(await getReviewPage(db, first["anna@example.se"])).toMatchObject({
		replaced: true,
		others: [],
	});
	await refused(
		decideReview(db, first["dora@example.se"], { approve: true, comment: "" }),
		/skickats på nytt/,
	);

	// Both approve (again): the protocol is justerat, and the sender is told.
	await clearOutbox(db);
	await decideReview(db, second["dora@example.se"], {
		approve: true,
		comment: "ignoreras",
	});
	expect(await listOutbox(db)).toEqual([]);
	await decideReview(db, second["anna@example.se"], {
		approve: true,
		comment: "",
	});
	const done = await getReviewRound(db, protocolId);
	expect(done).toMatchObject({ round: 2, state: "approved", changed: false });
	expect(done?.reviews.map((r) => [r.name, r.status, r.comment])).toEqual([
		["anna", "approved", ""],
		["Dora", "approved", ""],
	]);
	const [justerat] = await listOutbox(db);
	expect(justerat).toMatchObject({ to: "anna@example.se" });
	expect(justerat.text).toContain("är justerat av anna och Dora");
	await refused(sendForReview(db, anna, protocolId), /redan justerat/);
	expect(await isJusterat(db, protocolId)).toBe(true);

	// Any change afterwards means it is no longer justerat.
	await saveItemValue(
		db,
		anna,
		itemId("Ekonomi"),
		{ done: true, notes: "Ändrat efter justeringen." },
		randomUUID(),
	);
	expect(await isJusterat(db, protocolId)).toBe(false);
});

test("a protocol changed after sending can't be answered until sent again", async () => {
	await choose(`user:${anna}`, `user:${bo}`);
	await closeProtocol(db, anna, protocolId);
	await sendForReview(db, anna, protocolId);
	const sent = await links();
	await saveItemValue(
		db,
		anna,
		itemId("Ekonomi"),
		{ done: true, notes: "Ändrat efteråt." },
		randomUUID(),
	);
	expect(await getReviewPage(db, sent["bo@example.se"])).toMatchObject({
		changed: true,
	});
	await refused(
		decideReview(db, sent["bo@example.se"], { approve: true, comment: "" }),
		/har ändrats/,
	);
});

test("non-members can't send a protocol for justering", async () => {
	const cia = await mk("cia");
	await choose(`user:${anna}`, dora);
	await closeProtocol(db, anna, protocolId);
	await refused(sendForReview(db, cia, protocolId));
});
