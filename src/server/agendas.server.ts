import { randomBytes, randomUUID } from "node:crypto";
import type { Client, InStatement, Row } from "@libsql/client";
import { type Board, BoardError, requireMember } from "./boards.server";
import { defaultTemplateStatements } from "./default-template";
import { type Item, type ItemType, isItemType } from "./items";
import { guardProtocolEdit } from "./protocol-edits.server";

export type Template = { id: string; boardId: string; name: string };
export type Agenda = {
	id: string;
	boardId: string;
	shareId: string;
	title: string;
	meetingAt: string;
	location: string;
};

export const newShareId = () => randomBytes(18).toString("base64url");

export type ItemKind = "template" | "agenda" | "protocol";

// Fixed table names per kind; never built from user input.
const TABLES = {
	template: { parent: "templates", items: "template_items", fk: "template_id" },
	agenda: { parent: "agendas", items: "agenda_items", fk: "agenda_id" },
	protocol: {
		parent: "protocols",
		items: "protocol_items",
		fk: "protocol_id",
	},
} as const;

const MISSING: Record<ItemKind, string> = {
	template: "Mallen finns inte.",
	agenda: "Dagordningen finns inte.",
	protocol: "Protokollet finns inte.",
};

const toTemplate = (r: Row): Template => ({
	id: String(r.id),
	boardId: String(r.board_id),
	name: String(r.name),
});

const toAgenda = (r: Row): Agenda => ({
	id: String(r.id),
	boardId: String(r.board_id),
	shareId: String(r.share_id),
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

export function cleanNames(names: string[]): string[] {
	return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

export function configJson(type: ItemType, extraNames: string[]) {
	return type === "attendance"
		? JSON.stringify({ extraNames: cleanNames(extraNames) })
		: "{}";
}

export function requireTitle(input: string, message: string) {
	const title = input.trim();
	if (!title) throw new BoardError(message);
	return title;
}

const MEETING_AT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
export function cleanMeetingAt(input: string) {
	const v = input.trim();
	if (v && !MEETING_AT.test(v)) throw new BoardError("Ogiltigt datum.");
	return v;
}

export async function listItems(db: Client, kind: ItemKind, parentId: string) {
	const t = TABLES[kind];
	const res = await db.execute({
		sql: `SELECT * FROM ${t.items} WHERE ${t.fk} = ? ORDER BY position, id`,
		args: [parentId],
	});
	return res.rows.map(toItem);
}

/** Loads a template or agenda row and checks that the user is on its board. */
export async function requireParent(
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
	const missing = MISSING[kind];
	if (!row) throw new BoardError(missing);
	const board = await requireMember(db, userId, String(row.board_id)).catch(
		() => {
			throw new BoardError(missing);
		},
	);
	return { row, board };
}

export async function requireItem(
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
): Promise<(Agenda & { protocolId: string | null })[]> {
	await requireMember(db, userId, boardId);
	const res = await db.execute({
		sql: `SELECT a.*, p.id AS protocol_id FROM agendas a
          LEFT JOIN protocols p ON p.agenda_id = a.id
          WHERE a.board_id = ? ORDER BY a.meeting_at DESC, a.created_at DESC`,
		args: [boardId],
	});
	return res.rows.map((r) => ({
		...toAgenda(r),
		protocolId: r.protocol_id == null ? null : String(r.protocol_id),
	}));
}

export type AgendaDetails = {
	title: string;
	meetingAt: string;
	location: string;
};

/** A point brought over from an earlier protocol to a new agenda. */
export type CarriedItem = {
	title: string;
	type: ItemType;
	description: string;
	sourceItemId: string;
};

type NewItem = Pick<Item, "title" | "type" | "description" | "extraNames"> & {
	sourceItemId?: string;
};

const sameTitle = (a: string, b: string) =>
	a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Puts carried-over points on a new agenda. A point the template already has
 * (a standing point like "Ekonomi") is not added twice: the template's point
 * gets the carried description instead. Other points go with the other
 * matters: before "Övriga frågor" if there is one, else before the next
 * meeting and the closing.
 */
export function mergeCarried(items: NewItem[], carried: NewItem[]): NewItem[] {
	const merged = items.map((item) => ({ ...item }));
	const added: NewItem[] = [];
	for (const c of carried) {
		const standing = merged.find(
			(i) => !i.sourceItemId && sameTitle(i.title, c.title),
		);
		if (standing) {
			standing.description = c.description;
			standing.sourceItemId = c.sourceItemId;
		} else added.push(c);
	}
	if (added.length === 0) return merged;
	let at = merged.findIndex(
		(i) => i.type === "next_meeting" || i.type === "close",
	);
	if (at === -1) at = merged.length;
	const other = merged.findIndex((i) => sameTitle(i.title, "Övriga frågor"));
	if (other !== -1 && other < at) at = other;
	return [...merged.slice(0, at), ...added, ...merged.slice(at)];
}

/**
 * Creates an agenda, copying all items from the template if one is given,
 * plus any points carried over from an earlier meeting (see callMeeting).
 */
export async function createAgenda(
	db: Client,
	userId: string,
	boardId: string,
	input: AgendaDetails & { templateId?: string; carried?: CarriedItem[] },
): Promise<Agenda> {
	await requireMember(db, userId, boardId);
	const agenda: Agenda = {
		id: randomUUID(),
		boardId,
		shareId: newShareId(),
		title: requireTitle(input.title, "Ange en rubrik för mötet."),
		meetingAt: cleanMeetingAt(input.meetingAt),
		location: input.location.trim(),
	};

	let fromTemplate: Item[] = [];
	if (input.templateId) {
		const tpl = await requireParent(db, userId, "template", input.templateId);
		if (String(tpl.row.board_id) !== boardId)
			throw new BoardError("Mallen finns inte.");
		fromTemplate = await listItems(db, "template", input.templateId);
	}
	const items = mergeCarried(
		fromTemplate,
		(input.carried ?? []).map((c) => ({ ...c, extraNames: [] })),
	);

	const statements: InStatement[] = [
		{
			sql: `INSERT INTO agendas (id, board_id, share_id, title, meeting_at, location, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
			args: [
				agenda.id,
				boardId,
				agenda.shareId,
				agenda.title,
				agenda.meetingAt,
				agenda.location,
				userId,
			],
		},
		...items.map((item, i) => ({
			sql: `INSERT INTO agenda_items (id, agenda_id, position, title, type, description, config, source_item_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				randomUUID(),
				agenda.id,
				i + 1,
				item.title,
				item.type,
				item.description,
				configJson(item.type, item.extraNames),
				item.sourceItemId ?? null,
			],
		})),
	];
	await db.batch(statements, "write");
	return agenda;
}

export async function getAgenda(db: Client, userId: string, agendaId: string) {
	const { row, board } = await requireParent(db, userId, "agenda", agendaId);
	const protocol = await db.execute({
		sql: "SELECT id FROM protocols WHERE agenda_id = ?",
		args: [agendaId],
	});
	return {
		board,
		agenda: toAgenda(row),
		items: await listItems(db, "agenda", agendaId),
		protocolId: protocol.rows[0] ? String(protocol.rows[0].id) : null,
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
	editSession?: string,
) {
	await requireParent(db, userId, kind, parentId);
	if (kind === "protocol")
		await guardProtocolEdit(db, userId, parentId, editSession);
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
	editSession?: string,
) {
	const { parentId } = await requireItem(db, userId, kind, itemId);
	if (kind === "protocol")
		await guardProtocolEdit(db, userId, parentId, editSession);
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
	editSession?: string,
) {
	const { parentId } = await requireItem(db, userId, kind, itemId);
	if (kind === "protocol")
		await guardProtocolEdit(db, userId, parentId, editSession);
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
	editSession?: string,
) {
	const { parentId } = await requireItem(db, userId, kind, itemId);
	if (kind === "protocol")
		await guardProtocolEdit(db, userId, parentId, editSession);
	await db.execute({
		sql: `DELETE FROM ${TABLES[kind].items} WHERE id = ?`,
		args: [itemId],
	});
}

// ---------- Public sharing ----------

/** Anyone with the link may read the agenda; no account needed. */
export async function getPublicAgenda(db: Client, shareId: string) {
	if (!shareId) return null;
	const res = await db.execute({
		sql: `SELECT a.*, b.name AS board_name, b.background AS board_background FROM agendas a
          JOIN boards b ON b.id = a.board_id WHERE a.share_id = ?`,
		args: [shareId],
	});
	const row = res.rows[0];
	if (!row) return null;
	const { title, meetingAt, location } = toAgenda(row);
	const items = await listItems(db, "agenda", String(row.id));
	return {
		boardName: String(row.board_name),
		board: { background: String(row.board_background) },
		agenda: { title, meetingAt, location },
		items: items.map(({ id, title, description }) => ({
			id,
			title,
			description,
		})),
	};
}

/** Replaces the share link, so the old one stops working. */
export async function regenerateShareId(
	db: Client,
	userId: string,
	agendaId: string,
) {
	await requireParent(db, userId, "agenda", agendaId);
	const shareId = newShareId();
	await db.execute({
		sql: "UPDATE agendas SET share_id = ? WHERE id = ?",
		args: [shareId, agendaId],
	});
	return shareId;
}
