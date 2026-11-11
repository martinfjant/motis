import { createClient } from "@libsql/client";
import { beforeEach, expect, test } from "vitest";
import {
	addItem,
	createAgenda,
	deleteAgenda,
	deleteItem,
	getAgenda,
	listAgendas,
	listTemplates,
} from "./agendas.server";
import { createUser } from "./auth.server";
import {
	addMemberByEmail,
	BoardError,
	createBoard,
	setMemberTitle,
} from "./boards.server";
import { migrate } from "./migrate";
import {
	closeProtocol,
	createProtocol,
	deleteProtocol,
	getProtocol,
	listProtocols,
	saveItemValue,
	updateProtocol,
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

	await saveItemValue(db, bo, byTitle("Godkännande av dagordning"), {
		done: true,
		person: "ska bort",
		notes: " Dagordningen godkändes. ",
	});
	await saveItemValue(db, bo, byTitle("Mötets öppnande"), {
		at: "2026-11-20T18:03",
		done: true,
	});
	await saveItemValue(db, bo, byTitle("Närvarande ledamöter"), {
		present: ["anna", " bo ", "", "anna", "Revisor Lisa"],
	});
	await saveItemValue(db, bo, byTitle("Val av ordförande"), {
		person: " anna ",
		decision: "ska bort",
	});
	await saveItemValue(db, bo, byTitle("Ekonomi"), { done: true, notes: "" });
	await saveItemValue(db, bo, byTitle("Föregående protokoll"), { done: false });

	const saved = (await getProtocol(db, anna, protocol.id)).items;
	const value = (t: string) => saved.find((i) => i.title === t)?.value;
	expect(value("Godkännande av dagordning")).toEqual({
		done: true,
		notes: "Dagordningen godkändes.",
	});
	expect(value("Mötets öppnande")).toEqual({ at: "2026-11-20T18:03" });
	expect(value("Mötets avslutande")).toEqual({});
	expect(value("Närvarande ledamöter")).toEqual({
		present: ["anna", "bo", "Revisor Lisa"],
	});
	expect(value("Val av ordförande")).toEqual({ person: "anna" });
	expect(value("Ekonomi")).toEqual({});
	expect(value("Föregående protokoll")).toEqual({ done: false });

	// Everything but notes is required.
	const rejects = (t: string, v: object) =>
		expect(saveItemValue(db, bo, byTitle(t), v)).rejects.toThrow(BoardError);
	await rejects("Föregående protokoll", { notes: "bara anteckning" });
	await rejects("Mötets avslutande", { at: "igår kväll" });
	await rejects("Närvarande ledamöter", { present: [" "] });
	await rejects("Val av sekreterare", { person: "  " });
	// Text points only have notes, so an empty one is fine.
	await saveItemValue(db, bo, byTitle("Ekonomi"), {});
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

test("closing the meeting closes the protocol; later edits need a session and are logged", async () => {
	const protocol = await createProtocol(db, anna, agendaId);
	const items = (await getProtocol(db, anna, protocol.id)).items;
	const id = (t: string) => items.find((i) => i.title === t)?.id ?? "";

	await saveItemValue(db, anna, id("Mötets öppnande"), {
		at: "2026-11-20T18:00",
	});
	expect(
		(await getProtocol(db, anna, protocol.id)).protocol.closedAt,
	).toBeNull();

	await saveItemValue(db, anna, id("Mötets avslutande"), {
		at: "2026-11-20T19:30",
	});
	const closed = await getProtocol(db, anna, protocol.id);
	expect(closed.protocol.closedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	expect(closed.edits).toEqual([]);

	// Without an editing session nothing can change any more.
	const details = { title: "X", meetingAt: "", location: "" };
	await expect(
		saveItemValue(db, anna, id("Val av ordförande"), { person: "anna" }),
	).rejects.toThrow(BoardError);
	await expect(updateProtocol(db, anna, protocol.id, details)).rejects.toThrow(
		BoardError,
	);
	await expect(deleteItem(db, anna, "protocol", id("Ekonomi"))).rejects.toThrow(
		BoardError,
	);
	await expect(
		saveItemValue(db, anna, id("Val av ordförande"), { person: "anna" }, "nej"),
	).rejects.toThrow(BoardError);

	// One session = one logged edit, however many saves it makes.
	const session = "11111111-2222-4333-8444-555555555555";
	await saveItemValue(
		db,
		bo,
		id("Val av ordförande"),
		{ person: "anna" },
		session,
	);
	await addItem(
		db,
		bo,
		"protocol",
		protocol.id,
		{ title: "Tillägg", type: "text", description: "", extraNames: [] },
		session,
	);
	const other = "66666666-7777-4888-9999-000000000000";
	await updateProtocol(db, anna, protocol.id, details, other);

	const edited = await getProtocol(db, anna, protocol.id);
	expect(edited.edits.map((e) => e.userName)).toEqual(["bo", "anna"]);
	expect(edited.protocol.closedAt).toBe(closed.protocol.closedAt);

	// Someone else cannot reuse bo's session id to slip in an unlogged change.
	await expect(
		saveItemValue(
			db,
			anna,
			id("Val av sekreterare"),
			{ person: "bo" },
			session,
		),
	).rejects.toThrow(BoardError);
	expect((await getProtocol(db, anna, protocol.id)).edits).toHaveLength(2);
});

test("a protocol without a closing point can be closed by hand", async () => {
	const protocol = await createProtocol(db, anna, agendaId);
	await expect(closeProtocol(db, cia, protocol.id)).rejects.toThrow(BoardError);
	await closeProtocol(db, bo, protocol.id);
	expect(
		(await getProtocol(db, anna, protocol.id)).protocol.closedAt,
	).not.toBeNull();
});

test("members are written with their title, as it was when recorded", async () => {
	await setMemberTitle(db, anna, boardId, anna, "Ordförande");
	const protocol = await createProtocol(db, anna, agendaId);
	expect((await getProtocol(db, anna, protocol.id)).memberNames).toEqual([
		"anna (Ordförande)",
		"bo",
	]);

	// The edit history uses the same form.
	const items = (await getProtocol(db, anna, protocol.id)).items;
	const close = items.find((i) => i.type === "close")?.id ?? "";
	await saveItemValue(db, anna, close, { at: "2026-11-20T19:00" });
	const session = "11111111-2222-4333-8444-555555555555";
	await saveItemValue(db, anna, close, { at: "2026-11-20T19:05" }, session);
	expect((await getProtocol(db, anna, protocol.id)).edits[0].userName).toBe(
		"anna (Ordförande)",
	);
});
