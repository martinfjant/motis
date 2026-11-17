import { createClient } from "@libsql/client";
import { beforeEach, expect, test } from "vitest";
import { recordedBlocks } from "#/components/points/blocks";
import {
	addItem,
	createAgenda,
	createTemplate,
	deleteItem,
	deleteTemplate,
	getAgenda,
	getPublicAgenda,
	getTemplate,
	listAgendas,
	listTemplates,
	moveItem,
	regenerateShareId,
	updateItem,
} from "./agendas.server";
import { createUser } from "./auth.server";
import { addMemberByEmail, BoardError, createBoard } from "./boards.server";
import { DEFAULT_TEMPLATE_ITEMS } from "./default-template";
import { migrate } from "./migrate";

let db: ReturnType<typeof createClient>;
let anna: string, bo: string, boardId: string, templateId: string;

const mk = async (name: string) =>
	(
		await createUser(db, {
			name,
			email: `${name}@example.se`,
			password: "hemligt123",
		})
	).id;

const details = { title: "Styrelsemöte", meetingAt: "", location: "" };
const item = (title: string, type = "text") => ({
	title,
	type,
	description: "",
	extraNames: [],
});

beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	anna = await mk("anna");
	bo = await mk("bo");
	boardId = (await createBoard(db, anna, "BRF Björken")).id;
	templateId = (await listTemplates(db, anna, boardId))[0].id;
});

test("a new board gets its own copy of the default template", async () => {
	const { template, items } = await getTemplate(db, anna, templateId);
	expect(template.name).toBe("Styrelsemöte");
	expect(items.map((i) => [i.title, i.type])).toEqual(
		DEFAULT_TEMPLATE_ITEMS.map((i) => [i.title, i.type]),
	);
	const other = (await createBoard(db, anna, "BRF Eken")).id;
	const [otherTpl] = await listTemplates(db, anna, other);
	expect(otherTpl.id).not.toBe(templateId);
});

test("default template can be restored after deleting all templates", async () => {
	await deleteTemplate(db, anna, templateId);
	expect(await listTemplates(db, anna, boardId)).toEqual([]);
	await createTemplate(db, anna, boardId, { fromDefault: true });
	const [tpl] = await listTemplates(db, anna, boardId);
	expect((await getTemplate(db, anna, tpl.id)).items).toHaveLength(
		DEFAULT_TEMPLATE_ITEMS.length,
	);
});

test("non-members cannot see or touch templates and agendas", async () => {
	await expect(listTemplates(db, bo, boardId)).rejects.toThrow(BoardError);
	await expect(getTemplate(db, bo, templateId)).rejects.toThrow(BoardError);
	await expect(
		addItem(db, bo, "template", templateId, item("Hack")),
	).rejects.toThrow(BoardError);
	const agenda = await createAgenda(db, anna, boardId, details);
	await expect(getAgenda(db, bo, agenda.id)).rejects.toThrow(BoardError);
	await expect(listAgendas(db, bo, boardId)).rejects.toThrow(BoardError);
});

test("members can edit templates", async () => {
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	await addItem(db, bo, "template", templateId, item("Fastighetsskötsel"));
	const { items } = await getTemplate(db, bo, templateId);
	// Added last among the points, before the closing.
	expect(items.at(-2)?.title).toBe("Fastighetsskötsel");
	expect(items.at(-1)?.type).toBe("close");
});

test("agenda copies template items, later template edits do not leak", async () => {
	const agenda = await createAgenda(db, anna, boardId, {
		...details,
		templateId,
		meetingAt: "2026-11-20T18:00",
	});
	expect(agenda.shareId.length).toBeGreaterThanOrEqual(24);
	await addItem(db, anna, "template", templateId, item("Ny punkt"));
	const { items } = await getAgenda(db, anna, agenda.id);
	expect(items.map((i) => i.title)).toEqual(
		DEFAULT_TEMPLATE_ITEMS.map((i) => i.title),
	);
});

test("agenda cannot use another board's template", async () => {
	const other = (await createBoard(db, anna, "BRF Eken")).id;
	await expect(
		createAgenda(db, anna, other, { ...details, templateId }),
	).rejects.toThrow(BoardError);
});

test("rejects bad input", async () => {
	await expect(
		createAgenda(db, anna, boardId, { ...details, title: " " }),
	).rejects.toThrow(BoardError);
	await expect(
		createAgenda(db, anna, boardId, { ...details, meetingAt: "igår" }),
	).rejects.toThrow(BoardError);
	await expect(
		addItem(db, anna, "template", templateId, item("X", "bogus")),
	).rejects.toThrow(BoardError);
});

test("items can be added, edited, reordered and deleted", async () => {
	const agenda = await createAgenda(db, anna, boardId, details);
	await addItem(db, anna, "agenda", agenda.id, item("A"));
	await addItem(db, anna, "agenda", agenda.id, item("B"));
	await addItem(db, anna, "agenda", agenda.id, item("C"));
	let { items } = await getAgenda(db, anna, agenda.id);
	const [a, b, c] = items;

	await moveItem(db, anna, "agenda", c.id, -1);
	await moveItem(db, anna, "agenda", a.id, -1); // already first: no-op
	await updateItem(db, anna, "agenda", b.id, {
		title: "Närvaro",
		type: "attendance",
		description: " Kolla listan ",
		extraNames: ["Revisor Lisa", " ", "Revisor Lisa", "Förvaltare Per"],
	});
	await deleteItem(db, anna, "agenda", a.id);

	({ items } = await getAgenda(db, anna, agenda.id));
	expect(items.map((i) => i.title)).toEqual(["C", "Närvaro"]);
	expect(items[1]).toMatchObject({
		type: "attendance",
		description: "Kolla listan",
		extraNames: ["Revisor Lisa", "Förvaltare Per"],
	});

	// Extra names are dropped when the item stops being an attendance item.
	await updateItem(db, anna, "agenda", b.id, {
		...item("Närvaro"),
		extraNames: ["Revisor Lisa"],
	});
	({ items } = await getAgenda(db, anna, agenda.id));
	expect(items[1].extraNames).toEqual([]);
});

test("the opening is always first and the closing always last", async () => {
	const agenda = await createAgenda(db, anna, boardId, details);
	await addItem(db, anna, "agenda", agenda.id, item("A"));
	await addItem(
		db,
		anna,
		"agenda",
		agenda.id,
		item("Mötets avslutande", "close"),
	);
	await addItem(db, anna, "agenda", agenda.id, item("B"));
	await addItem(db, anna, "agenda", agenda.id, item("Mötets öppnande", "open"));
	const titles = async () =>
		(await getAgenda(db, anna, agenda.id)).items.map((i) => i.title);
	// New points go before the closing; the opening goes first.
	expect(await titles()).toEqual([
		"Mötets öppnande",
		"A",
		"B",
		"Mötets avslutande",
	]);

	const items = (await getAgenda(db, anna, agenda.id)).items;
	const [open, a, b, close] = items;
	// Nothing moves past them, and they don't move.
	await expect(moveItem(db, anna, "agenda", a.id, -1)).rejects.toThrow(
		BoardError,
	);
	await expect(moveItem(db, anna, "agenda", b.id, 1)).rejects.toThrow(
		BoardError,
	);
	await expect(moveItem(db, anna, "agenda", open.id, 1)).rejects.toThrow(
		BoardError,
	);
	await expect(moveItem(db, anna, "agenda", close.id, -1)).rejects.toThrow(
		BoardError,
	);
	await moveItem(db, anna, "agenda", b.id, -1);
	expect(await titles()).toEqual([
		"Mötets öppnande",
		"B",
		"A",
		"Mötets avslutande",
	]);

	// Only one of each, whether added or by changing a point's type.
	await expect(
		addItem(db, anna, "agenda", agenda.id, item("Avslut 2", "close")),
	).rejects.toThrow(BoardError);
	await expect(
		updateItem(db, anna, "agenda", a.id, item("A", "open")),
	).rejects.toThrow(BoardError);

	// A point that becomes the closing moves to the end.
	await deleteItem(db, anna, "agenda", close.id);
	await updateItem(db, anna, "agenda", b.id, item("Slut", "close"));
	expect(await titles()).toEqual(["Mötets öppnande", "A", "Slut"]);
});

test("ja/nej points say in the protocol what the answer means", async () => {
	// The default template's ja/nej points come with wording.
	const { items: tpl } = await getTemplate(db, anna, templateId);
	expect(
		tpl.find((i) => i.title === "Godkännande av dagordning"),
	).toMatchObject({
		yesText: "Dagordningen godkändes.",
		noText: "Dagordningen godkändes inte.",
	});

	const agenda = await createAgenda(db, anna, boardId, details);
	await addItem(db, anna, "agenda", agenda.id, {
		...item("Budget", "toggle"),
		yesText: " Budgeten antogs. ",
		noText: "",
	});
	let [budget] = (await getAgenda(db, anna, agenda.id)).items;
	expect(budget).toMatchObject({ yesText: "Budgeten antogs.", noText: "" });
	expect(recordedBlocks({ ...budget, value: { answer: true } })[0]).toEqual({
		kind: "text",
		text: "Budgeten antogs.",
	});
	// No wording: plain Nej.
	expect(recordedBlocks({ ...budget, value: { answer: false } })[0]).toEqual({
		kind: "text",
		text: "Nej",
	});

	// Wording only belongs to ja/nej points.
	await updateItem(db, anna, "agenda", budget.id, {
		...item("Budget", "text"),
		yesText: "Budgeten antogs.",
	});
	[budget] = (await getAgenda(db, anna, agenda.id)).items;
	expect(budget).toMatchObject({ yesText: "", noText: "" });
});

test("an item id from an agenda cannot be edited as a template item", async () => {
	const agenda = await createAgenda(db, anna, boardId, details);
	await addItem(db, anna, "agenda", agenda.id, item("A"));
	const [a] = (await getAgenda(db, anna, agenda.id)).items;
	await expect(
		updateItem(db, anna, "template", a.id, item("X")),
	).rejects.toThrow(BoardError);
});

test("public agenda is readable by share id and exposes only safe fields", async () => {
	const agenda = await createAgenda(db, anna, boardId, {
		title: "Höstmöte",
		meetingAt: "2026-11-20T18:00",
		location: "Lokalen",
		templateId,
	});
	const pub = await getPublicAgenda(db, agenda.shareId);
	expect(pub?.boardName).toBe("BRF Björken");
	expect(pub?.agenda).toEqual({
		title: "Höstmöte",
		meetingAt: "2026-11-20T18:00",
		location: "Lokalen",
	});
	expect(pub?.items).toHaveLength(DEFAULT_TEMPLATE_ITEMS.length);
	expect(Object.keys(pub?.items[0] ?? {}).sort()).toEqual([
		"description",
		"id",
		"title",
	]);
	expect(await getPublicAgenda(db, "")).toBeNull();
	expect(await getPublicAgenda(db, "nope")).toBeNull();
});

test("regenerating the share id revokes the old link, members only", async () => {
	const agenda = await createAgenda(db, anna, boardId, details);
	await expect(regenerateShareId(db, bo, agenda.id)).rejects.toThrow(
		BoardError,
	);
	const shareId = await regenerateShareId(db, anna, agenda.id);
	expect(shareId).not.toBe(agenda.shareId);
	expect(await getPublicAgenda(db, agenda.shareId)).toBeNull();
	expect(await getPublicAgenda(db, shareId)).not.toBeNull();
});
