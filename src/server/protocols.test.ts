import { createClient } from "@libsql/client";
import { beforeEach, expect, test } from "vitest";
import {
	addItem,
	createAgenda,
	deleteAgenda,
	getAgenda,
	listAgendas,
	listTemplates,
} from "./agendas.server";
import { createUser } from "./auth.server";
import { addMemberByEmail, BoardError, createBoard } from "./boards.server";
import { migrate } from "./migrate";
import {
	createProtocol,
	deleteProtocol,
	getProtocol,
	listProtocols,
	saveItemValue,
} from "./protocols.server";

let db: ReturnType<typeof createClient>;
let anna: string, bo: string, cia: string, boardId: string, agendaId: string;

const mk = async (name: string) =>
	(
		await createUser(db, {
			name,
			email: `${name}@example.se`,
			password: "hemligt123",
		})
	).id;

beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	anna = await mk("anna");
	bo = await mk("bo");
	cia = await mk("cia");
	boardId = (await createBoard(db, anna, "BRF Björken")).id;
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	const [tpl] = await listTemplates(db, anna, boardId);
	agendaId = (
		await createAgenda(db, anna, boardId, {
			title: "Höstmöte",
			meetingAt: "2026-11-20T18:00",
			location: "Lokalen",
			templateId: tpl.id,
		})
	).id;
});

test("a protocol copies the agenda and leaves it untouched", async () => {
	const protocol = await createProtocol(db, bo, agendaId);
	expect(protocol).toMatchObject({
		title: "Höstmöte",
		meetingAt: "2026-11-20T18:00",
		location: "Lokalen",
		agendaId,
	});
	const agenda = await getAgenda(db, anna, agendaId);
	expect(agenda.protocolId).toBe(protocol.id);
	expect(protocol.shareId).not.toBe(agenda.agenda.shareId);
	expect(protocol.shareId.length).toBeGreaterThanOrEqual(24);

	const { items, memberNames } = await getProtocol(db, anna, protocol.id);
	expect(items.map((i) => i.title)).toEqual(agenda.items.map((i) => i.title));
	expect(memberNames).toEqual(["anna", "bo"]);

	// Editing the protocol does not touch the agenda.
	await addItem(db, anna, "protocol", protocol.id, {
		title: "Extra punkt",
		type: "text",
		description: "",
		extraNames: [],
	});
	expect((await getAgenda(db, anna, agendaId)).items).toHaveLength(
		agenda.items.length,
	);
});

test("one protocol per agenda", async () => {
	expect((await listAgendas(db, anna, boardId))[0].protocolId).toBeNull();
	const a = await createProtocol(db, anna, agendaId);
	const b = await createProtocol(db, bo, agendaId);
	expect(b.id).toBe(a.id);
	expect(await listProtocols(db, anna, boardId)).toHaveLength(1);
	const [listed] = await listAgendas(db, anna, boardId);
	expect(listed.protocolId).toBe(a.id);
});

test("non-members cannot create, read or fill in protocols", async () => {
	await expect(createProtocol(db, cia, agendaId)).rejects.toThrow(BoardError);
	const protocol = await createProtocol(db, anna, agendaId);
	await expect(getProtocol(db, cia, protocol.id)).rejects.toThrow(BoardError);
	const [first] = (await getProtocol(db, anna, protocol.id)).items;
	await expect(
		saveItemValue(db, cia, first.id, { done: true }),
	).rejects.toThrow(BoardError);
});

test("values are stored per type and stray fields dropped", async () => {
	const protocol = await createProtocol(db, anna, agendaId);
	const items = (await getProtocol(db, anna, protocol.id)).items;
	const byTitle = (t: string) => {
		const item = items.find((i) => i.title === t);
		if (!item) throw new Error(t);
		return item.id;
	};

	await saveItemValue(db, bo, byTitle("Mötets öppnande"), {
		done: true,
		person: "ska bort",
		notes: " Ordföranden öppnade mötet. ",
	});
	await saveItemValue(db, bo, byTitle("Närvarande ledamöter"), {
		present: ["anna", " bo ", "", "anna", "Revisor Lisa"],
	});
	await saveItemValue(db, bo, byTitle("Val av ordförande"), {
		person: " anna ",
		decision: "ska bort",
	});
	await saveItemValue(db, bo, byTitle("Ekonomi"), { done: true, notes: "" });

	const saved = (await getProtocol(db, anna, protocol.id)).items;
	const value = (t: string) => saved.find((i) => i.title === t)?.value;
	expect(value("Mötets öppnande")).toEqual({
		done: true,
		notes: "Ordföranden öppnade mötet.",
	});
	expect(value("Närvarande ledamöter")).toEqual({
		present: ["anna", "bo", "Revisor Lisa"],
	});
	expect(value("Val av ordförande")).toEqual({ person: "anna" });
	expect(value("Ekonomi")).toEqual({});
});

test("deleting the agenda keeps the protocol, and vice versa", async () => {
	const protocol = await createProtocol(db, anna, agendaId);
	await deleteProtocol(db, anna, protocol.id);
	expect((await getAgenda(db, anna, agendaId)).protocolId).toBeNull();

	const again = await createProtocol(db, anna, agendaId);
	await deleteAgenda(db, anna, agendaId);
	const kept = await getProtocol(db, anna, again.id);
	expect(kept.protocol.agendaId).toBeNull();
	expect(kept.items.length).toBeGreaterThan(0);
});
