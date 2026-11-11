import { randomBytes, randomUUID } from "node:crypto";
import type { Client, InStatement, Row } from "@libsql/client";
import { type Board, BoardError, requireMember } from "./boards.server";
import { defaultTemplateStatements } from "./default-template";
import { type Item, type ItemType, isItemType } from "./items";

export type Template = { id: string; boardId: string; name: string };
export type Agenda = {
	id: string;
	boardId: string;
	slug: string;
	title: string;
	meetingAt: string;
	location: string;
};

export type ItemKind = "template" | "agenda";

// Fixed table names per kind; never built from user input.
const TABLES = {
	template: { parent: "templates", items: "template_items", fk: "template_id" },
	agenda: { parent: "agendas", items: "agenda_items", fk: "agenda_id" },
} as const;

const toTemplate = (r: Row): Template => ({
	id: String(r.id),
	boardId: String(r.board_id),
	name: String(r.name),
});

const toAgenda = (r: Row): Agenda => ({
	id: String(r.id),
	boardId: String(r.board_id),
	slug: String(r.slug),
	title: String(r.title),
	meetingAt: String(r.meeting_at),
	location: String(r.location),
});

function toItem(r: Row): Item {
	let config: { extraNames?: unknown } = {};
	try {
		config = JSON.parse(String(r.config));
	} catch {}
	return {
		id: String(r.id),
		position: Number(r.position),
		title: String(r.title),
		type: r.type as ItemType,
		description: String(r.description),
		extraNames: Array.isArray(config.extraNames)
			? config.extraNames.map(String)
			: [],
	};
}

function cleanNames(names: string[]): string[] {
	return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

function configJson(type: ItemType, extraNames: string[]) {
	return type === "attendance"
		? JSON.stringify({ extraNames: cleanNames(extraNames) })
		: "{}";
}

function requireTitle(input: string, message: string) {
	const title = input.trim();
	if (!title) throw new BoardError(message);
	return title;
}

const MEETING_AT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
function cleanMeetingAt(input: string) {
	const v = input.trim();
	if (v && !MEETING_AT.test(v)) throw new BoardError("Ogiltigt datum.");
	return v;
}

async function listItems(db: Client, kind: ItemKind, parentId: string) {
	const t = TABLES[kind];
	const res = await db.execute({
		sql: `SELECT * FROM ${t.items} WHERE ${t.fk} = ? ORDER BY position, id`,
		args: [parentId],
	});
	return res.rows.map(toItem);
}

/** Loads a template or agenda row and checks that the user is on its board. */
async function requireParent(
	db: Client,
	userId: string,
	kind: ItemKind,
	parentId: string,
): Promise<{ row: Row; board: Board }> {
	const res = await db.execute({
		sql: `SELECT * FROM ${TABLES[kind].parent} WHERE id = ?`,
		args: [parentId],
	});
	const row = res.rows[0];
	const missing =
		kind === "template" ? "Mallen finns inte." : "Dagordningen finns inte.";
	if (!row) throw new BoardError(missing);
	const board = await requireMember(db, userId, String(row.board_id)).catch(
		() => {
			throw new BoardError(missing);
		},
	);
	return { row, board };
}

async function requireItem(
	db: Client,
	userId: string,
	kind: ItemKind,
	itemId: string,
) {
	const t = TABLES[kind];
	const res = await db.execute({
		sql: `SELECT * FROM ${t.items} WHERE id = ?`,
		args: [itemId],
	});
	const row = res.rows[0];
	if (!row) throw new BoardError("Punkten finns inte.");
	const parentId = String(row[t.fk]);
	await requireParent(db, userId, kind, parentId);
	return { item: toItem(row), parentId };
}

// ---------- Templates ----------

export async function listTemplates(
	db: Client,
	userId: string,
	boardId: string,
): Promise<Template[]> {
	await requireMember(db, userId, boardId);
	const res = await db.execute({
		sql: "SELECT * FROM templates WHERE board_id = ? ORDER BY name, created_at",
		args: [boardId],
	});
	return res.rows.map(toTemplate);
}

/** Creates an empty template, or a copy of the built-in default. */
export async function createTemplate(
	db: Client,
	userId: string,
	boardId: string,
	opts: { name?: string; fromDefault?: boolean },
): Promise<Template> {
	await requireMember(db, userId, boardId);
	if (opts.fromDefault) {
		const { id, statements } = defaultTemplateStatements(boardId);
		await db.batch(statements, "write");
		return getTemplateRow(db, id);
	}
	const name = requireTitle(opts.name ?? "", "Ange ett namn på mallen.");
	const id = randomUUID();
	await db.execute({
		sql: "INSERT INTO templates (id, board_id, name) VALUES (?, ?, ?)",
		args: [id, boardId, name],
	});
	return { id, boardId, name };
}

async function getTemplateRow(db: Client, id: string) {
	const res = await db.execute({
		sql: "SELECT * FROM templates WHERE id = ?",
		args: [id],
	});
	return toTemplate(res.rows[0]);
}

export async function getTemplate(
	db: Client,
	userId: string,
	templateId: string,
) {
	const { row, board } = await requireParent(
		db,
		userId,
		"template",
		templateId,
	);
	return {
		board,
		template: toTemplate(row),
		items: await listItems(db, "template", templateId),
	};
}

export async function renameTemplate(
	db: Client,
	userId: string,
	templateId: string,
	nameInput: string,
) {
	await requireParent(db, userId, "template", templateId);
	const name = requireTitle(nameInput, "Ange ett namn på mallen.");
	await db.execute({
		sql: "UPDATE templates SET name = ? WHERE id = ?",
		args: [name, templateId],
	});
}

export async function deleteTemplate(
	db: Client,
	userId: string,
	templateId: string,
) {
	await requireParent(db, userId, "template", templateId);
	await db.execute({
		sql: "DELETE FROM templates WHERE id = ?",
		args: [templateId],
	});
}

// ---------- Agendas ----------

export async function listAgendas(
	db: Client,
	userId: string,
	boardId: string,
): Promise<Agenda[]> {
	await requireMember(db, userId, boardId);
	const res = await db.execute({
		sql: "SELECT * FROM agendas WHERE board_id = ? ORDER BY meeting_at DESC, created_at DESC",
		args: [boardId],
	});
	return res.rows.map(toAgenda);
}

export type AgendaDetails = {
	title: string;
	meetingAt: string;
	location: string;
};

/** Creates an agenda, copying all items from the template if one is given. */
export async function createAgenda(
	db: Client,
	userId: string,
	boardId: string,
	input: AgendaDetails & { templateId?: string },
): Promise<Agenda> {
	await requireMember(db, userId, boardId);
	const agenda: Agenda = {
		id: randomUUID(),
		boardId,
		slug: randomBytes(18).toString("base64url"),
		title: requireTitle(input.title, "Ange en rubrik för mötet."),
		meetingAt: cleanMeetingAt(input.meetingAt),
		location: input.location.trim(),
	};

	let items: Item[] = [];
	if (input.templateId) {
		const tpl = await requireParent(db, userId, "template", input.templateId);
		if (String(tpl.row.board_id) !== boardId)
			throw new BoardError("Mallen finns inte.");
		items = await listItems(db, "template", input.templateId);
	}

	const statements: InStatement[] = [
		{
			sql: `INSERT INTO agendas (id, board_id, slug, title, meeting_at, location, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
			args: [
				agenda.id,
				boardId,
				agenda.slug,
				agenda.title,
				agenda.meetingAt,
				agenda.location,
				userId,
			],
		},
		...items.map((item, i) => ({
			sql: `INSERT INTO agenda_items (id, agenda_id, position, title, type, description, config)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
			args: [
				randomUUID(),
				agenda.id,
				i + 1,
				item.title,
				item.type,
				item.description,
				configJson(item.type, item.extraNames),
			],
		})),
	];
	await db.batch(statements, "write");
	return agenda;
}

export async function getAgenda(db: Client, userId: string, agendaId: string) {
	const { row, board } = await requireParent(db, userId, "agenda", agendaId);
	return {
		board,
		agenda: toAgenda(row),
		items: await listItems(db, "agenda", agendaId),
	};
}

export async function updateAgenda(
	db: Client,
	userId: string,
	agendaId: string,
	input: AgendaDetails,
) {
	await requireParent(db, userId, "agenda", agendaId);
	await db.execute({
		sql: "UPDATE agendas SET title = ?, meeting_at = ?, location = ? WHERE id = ?",
		args: [
			requireTitle(input.title, "Ange en rubrik för mötet."),
			cleanMeetingAt(input.meetingAt),
			input.location.trim(),
			agendaId,
		],
	});
}

export async function deleteAgenda(
	db: Client,
	userId: string,
	agendaId: string,
) {
	await requireParent(db, userId, "agenda", agendaId);
	await db.execute({
		sql: "DELETE FROM agendas WHERE id = ?",
		args: [agendaId],
	});
}

// ---------- Items (shared by templates and agendas) ----------

export type ItemInput = {
	title: string;
	type: string;
	description: string;
	extraNames: string[];
};

function cleanItem(input: ItemInput) {
	if (!isItemType(input.type)) throw new BoardError("Ogiltig typ av punkt.");
	return {
		title: requireTitle(input.title, "Ange en rubrik för punkten."),
		type: input.type,
		description: input.description.trim(),
		config: configJson(input.type, input.extraNames),
	};
}

export async function addItem(
	db: Client,
	userId: string,
	kind: ItemKind,
	parentId: string,
	input: ItemInput,
) {
	await requireParent(db, userId, kind, parentId);
	const t = TABLES[kind];
	const item = cleanItem(input);
	await db.execute({
		sql: `INSERT INTO ${t.items} (id, ${t.fk}, position, title, type, description, config)
          VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM ${t.items} WHERE ${t.fk} = ?), ?, ?, ?, ?)`,
		args: [
			randomUUID(),
			parentId,
			parentId,
			item.title,
			item.type,
			item.description,
			item.config,
		],
	});
}

export async function updateItem(
	db: Client,
	userId: string,
	kind: ItemKind,
	itemId: string,
	input: ItemInput,
) {
	await requireItem(db, userId, kind, itemId);
	const item = cleanItem(input);
	await db.execute({
		sql: `UPDATE ${TABLES[kind].items} SET title = ?, type = ?, description = ?, config = ? WHERE id = ?`,
		args: [item.title, item.type, item.description, item.config, itemId],
	});
}

/** Swaps the item with its neighbour above (-1) or below (+1). */
export async function moveItem(
	db: Client,
	userId: string,
	kind: ItemKind,
	itemId: string,
	direction: -1 | 1,
) {
	const { parentId } = await requireItem(db, userId, kind, itemId);
	const items = await listItems(db, kind, parentId);
	const i = items.findIndex((it) => it.id === itemId);
	const j = i + direction;
	if (j < 0 || j >= items.length) return;
	const reordered = [...items];
	[reordered[i], reordered[j]] = [reordered[j], reordered[i]];
	await db.batch(
		reordered.map((it, k) => ({
			sql: `UPDATE ${TABLES[kind].items} SET position = ? WHERE id = ?`,
			args: [k + 1, it.id],
		})),
		"write",
	);
}

export async function deleteItem(
	db: Client,
	userId: string,
	kind: ItemKind,
	itemId: string,
) {
	await requireItem(db, userId, kind, itemId);
	await db.execute({
		sql: `DELETE FROM ${TABLES[kind].items} WHERE id = ?`,
		args: [itemId],
	});
}
