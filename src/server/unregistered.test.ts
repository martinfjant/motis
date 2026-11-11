import { createClient } from "@libsql/client";
import { beforeEach, expect, test } from "vitest";
import { createAgenda } from "./agendas.server";
import { createUser } from "./auth.server";
import {
	addMember,
	addMemberByEmail,
	BoardError,
	createBoard,
	getBoard,
	linkUnregistered,
	listMembers,
	listUnregistered,
	removeUnregistered,
	updateUnregistered,
} from "./boards.server";
import { migrate } from "./migrate";
import { createProtocol, getProtocol } from "./protocols.server";

let db: ReturnType<typeof createClient>;
let anna: string, bo: string, boardId: string;

const mk = async (name: string, email = `${name}@example.se`) =>
	(await createUser(db, { name, email, password: "hemligt123" })).id;

beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	anna = await mk("Anna");
	bo = await mk("Bo");
	boardId = (await createBoard(db, anna, "BRF Björken")).id;
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
});

const dag = { name: "Dag Dagsson", email: "Dag@Example.se", title: "Kassör" };

test("someone without an account is added with name, email and title", async () => {
	expect(await addMember(db, anna, boardId, dag)).toEqual({
		registered: false,
	});
	expect(await listUnregistered(db, bo, boardId)).toEqual([
		{
			id: expect.any(String),
			name: "Dag Dagsson",
			email: "dag@example.se",
			title: "Kassör",
			hasAccount: false,
		},
	]);
	// No account means no access.
	expect(await listMembers(db, anna, boardId)).toHaveLength(2);
});

test("someone with an account becomes a member straight away", async () => {
	const cia = await mk("Cia");
	expect(
		await addMember(db, anna, boardId, {
			name: "",
			email: "cia@example.se",
			title: "Sekreterare",
		}),
	).toEqual({ registered: true });
	expect((await getBoard(db, cia, boardId))?.title).toBe("Sekreterare");
	expect(await listUnregistered(db, anna, boardId)).toEqual([]);
});

test("adding needs a name, a free email, and an admin", async () => {
	await expect(
		addMember(db, anna, boardId, { name: " ", email: "", title: "" }),
	).rejects.toThrow("Ange personens namn.");
	await addMember(db, anna, boardId, dag);
	await expect(addMember(db, anna, boardId, dag)).rejects.toThrow(
		"Någon i styrelsen har redan den e-postadressen.",
	);
	// No email is fine, and several can lack one.
	await addMember(db, anna, boardId, { name: "Eva", email: "", title: "" });
	await addMember(db, anna, boardId, { name: "Fia", email: "", title: "" });
	await expect(
		addMember(db, bo, boardId, { name: "Gun", email: "", title: "" }),
	).rejects.toThrow(BoardError);
});

test("admins change and remove members without account", async () => {
	await addMember(db, anna, boardId, dag);
	const [{ id }] = await listUnregistered(db, anna, boardId);
	await expect(
		updateUnregistered(db, bo, boardId, id, { ...dag, title: "Ordförande" }),
	).rejects.toThrow(BoardError);
	await updateUnregistered(db, anna, boardId, id, {
		...dag,
		title: "Ordförande",
	});
	expect((await listUnregistered(db, anna, boardId))[0].title).toBe(
		"Ordförande",
	);
	await removeUnregistered(db, anna, boardId, id);
	expect(await listUnregistered(db, anna, boardId)).toEqual([]);
});

test("after registering, an admin links them up and the title is kept", async () => {
	await addMember(db, anna, boardId, dag);
	const [{ id }] = await listUnregistered(db, anna, boardId);
	await expect(linkUnregistered(db, anna, boardId, id)).rejects.toThrow(
		"Det finns inget konto",
	);

	// Registering alone gives no access: emails are not verified.
	const dagId = await mk("Dag", "dag@example.se");
	expect(await getBoard(db, dagId, boardId)).toBeNull();
	expect((await listUnregistered(db, anna, boardId))[0].hasAccount).toBe(true);

	await expect(linkUnregistered(db, bo, boardId, id)).rejects.toThrow(
		BoardError,
	);
	await linkUnregistered(db, anna, boardId, id);
	expect(await getBoard(db, dagId, boardId)).toMatchObject({
		role: "member",
		title: "Kassör",
	});
	expect(await listUnregistered(db, anna, boardId)).toEqual([]);
});

test("protocols offer everyone on the board, by name", async () => {
	await addMember(db, anna, boardId, dag);
	await addMember(db, anna, boardId, { name: "Cecilia", email: "", title: "" });
	const agenda = await createAgenda(db, anna, boardId, {
		title: "Möte",
		meetingAt: "2026-11-20T18:00",
		location: "",
	});
	const protocol = await createProtocol(db, anna, agenda.id, { anyDay: true });
	expect((await getProtocol(db, bo, protocol.id)).memberNames).toEqual([
		"Anna",
		"Bo",
		"Cecilia",
		"Dag Dagsson (Kassör)",
	]);
});
