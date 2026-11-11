import { randomUUID } from "node:crypto";
import type { Client, Row } from "@libsql/client";
import {
	type AgendaDetails,
	cleanMeetingAt,
	cleanNames,
	configJson,
	listItems,
	newShareId,
	requireItem,
	requireParent,
	requireTitle,
} from "./agendas.server";
import { BoardError, listMembers, requireMember } from "./boards.server";
import type { ItemType, ProtocolItem, ProtocolValue } from "./items";
import { guardProtocolEdit } from "./protocol-edits.server";

export type Protocol = {
	id: string;
	boardId: string;
	agendaId: string | null;
	shareId: string;
	title: string;
	meetingAt: string;
	location: string;
	/** ISO 8601 UTC, or null while the meeting is going on. */
	closedAt: string | null;
};

export type ProtocolEdit = { userName: string; editedAt: string };

const toProtocol = (r: Row): Protocol => ({
	id: String(r.id),
	boardId: String(r.board_id),
	agendaId: r.agenda_id == null ? null : String(r.agenda_id),
	shareId: String(r.share_id),
	title: String(r.title),
	meetingAt: String(r.meeting_at),
	location: String(r.location),
	closedAt: r.closed_at == null ? null : String(r.closed_at),
});

function parseValue(raw: unknown): ProtocolValue {
	try {
		const v = JSON.parse(String(raw));
		return v && typeof v === "object" ? v : {};
	} catch {
		return {};
	}
}

const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Keeps only the fields that make sense for the item's type. */
export function cleanValue(
	type: ItemType,
	input: ProtocolValue,
): ProtocolValue {
	const notes = (input.notes ?? "").trim();
	const base = notes ? { notes } : {};
	switch (type) {
		case "toggle":
			return typeof input.done === "boolean"
				? { ...base, done: input.done }
				: base;
		case "open":
		case "close": {
			const at = (input.at ?? "").trim();
			return AT.test(at) ? { ...base, at } : base;
		}
		case "attendance":
			return { ...base, present: cleanNames(input.present ?? []) };
		case "person": {
			const person = (input.person ?? "").trim();
			return person ? { ...base, person } : base;
		}
		case "decision": {
			const decision = (input.decision ?? "").trim();
			return decision ? { ...base, decision } : base;
		}
		default:
			return base;
	}
}

async function listProtocolItems(
	db: Client,
	protocolId: string,
): Promise<ProtocolItem[]> {
	const [items, values] = await Promise.all([
		listItems(db, "protocol", protocolId),
		db.execute({
			sql: "SELECT id, value FROM protocol_items WHERE protocol_id = ?",
			args: [protocolId],
		}),
	]);
	const byId = new Map(values.rows.map((r) => [String(r.id), r.value]));
	return items.map((item) => ({
		...item,
		value: parseValue(byId.get(item.id)),
	}));
}

export async function listProtocols(
	db: Client,
	userId: string,
	boardId: string,
): Promise<Protocol[]> {
	await requireMember(db, userId, boardId);
	const res = await db.execute({
		sql: "SELECT * FROM protocols WHERE board_id = ? ORDER BY meeting_at DESC, created_at DESC",
		args: [boardId],
	});
	return res.rows.map(toProtocol);
}

/**
 * Starts the minutes for an agenda by copying its details and points.
 * The agenda itself is left as it was. If the agenda already has a
 * protocol, that one is returned instead of creating a second.
 */
export async function createProtocol(
	db: Client,
	userId: string,
	agendaId: string,
): Promise<Protocol> {
	const { row } = await requireParent(db, userId, "agenda", agendaId);
	const existing = await db.execute({
		sql: "SELECT * FROM protocols WHERE agenda_id = ?",
		args: [agendaId],
	});
	if (existing.rows[0]) return toProtocol(existing.rows[0]);

	const protocol: Protocol = {
		id: randomUUID(),
		boardId: String(row.board_id),
		agendaId,
		shareId: newShareId(),
		title: String(row.title),
		meetingAt: String(row.meeting_at),
		location: String(row.location),
		closedAt: null,
	};
	const items = await listItems(db, "agenda", agendaId);
	await db.batch(
		[
			{
				sql: `INSERT INTO protocols (id, board_id, agenda_id, share_id, title, meeting_at, location, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				args: [
					protocol.id,
					protocol.boardId,
					agendaId,
					protocol.shareId,
					protocol.title,
					protocol.meetingAt,
					protocol.location,
					userId,
				],
			},
			...items.map((item, i) => ({
				sql: `INSERT INTO protocol_items (id, protocol_id, position, title, type, description, config)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
				args: [
					randomUUID(),
					protocol.id,
					i + 1,
					item.title,
					item.type,
					item.description,
					configJson(item.type, item.extraNames),
				],
			})),
		],
		"write",
	);
	return protocol;
}

export async function getProtocol(
	db: Client,
	userId: string,
	protocolId: string,
) {
	const { row, board } = await requireParent(
		db,
		userId,
		"protocol",
		protocolId,
	);
	const members = await listMembers(db, userId, board.id);
	const edits = await db.execute({
		sql: "SELECT user_name, edited_at FROM protocol_edits WHERE protocol_id = ? ORDER BY edited_at",
		args: [protocolId],
	});
	return {
		board,
		protocol: toProtocol(row),
		items: await listProtocolItems(db, protocolId),
		/** Changes made after the protocol was closed, oldest first. */
		edits: edits.rows.map(
			(r): ProtocolEdit => ({
				userName: String(r.user_name),
				editedAt: String(r.edited_at),
			}),
		),
		/** Board members' names, for attendance and person choices. */
		memberNames: members.map((m) => m.name),
	};
}

export async function updateProtocol(
	db: Client,
	userId: string,
	protocolId: string,
	input: AgendaDetails,
	editSession?: string,
) {
	await requireParent(db, userId, "protocol", protocolId);
	await guardProtocolEdit(db, userId, protocolId, editSession);
	await db.execute({
		sql: "UPDATE protocols SET title = ?, meeting_at = ?, location = ? WHERE id = ?",
		args: [
			requireTitle(input.title, "Ange en rubrik för mötet."),
			cleanMeetingAt(input.meetingAt),
			input.location.trim(),
			protocolId,
		],
	});
}

export async function deleteProtocol(
	db: Client,
	userId: string,
	protocolId: string,
) {
	await requireParent(db, userId, "protocol", protocolId);
	await db.execute({
		sql: "DELETE FROM protocols WHERE id = ?",
		args: [protocolId],
	});
}

/** Records what happened at the meeting for one point. */
/** Everything except notes is required; returns the problem, if any. */
export function missingValue(type: ItemType, v: ProtocolValue): string | null {
	switch (type) {
		case "toggle":
			return v.done === undefined ? "Välj ja eller nej." : null;
		case "open":
		case "close":
			return v.at ? null : "Ange en giltig tidpunkt.";
		case "attendance":
			return v.present?.length ? null : "Ange minst en närvarande.";
		case "person":
			return v.person ? null : "Välj en person.";
		case "decision":
			return v.decision ? null : "Skriv beslutet.";
		default:
			return null;
	}
}

export async function saveItemValue(
	db: Client,
	userId: string,
	itemId: string,
	input: ProtocolValue,
	editSession?: string,
) {
	const { item, parentId } = await requireItem(db, userId, "protocol", itemId);
	const value = cleanValue(item.type, input);
	const missing = missingValue(item.type, value);
	if (missing) throw new BoardError(missing);
	await guardProtocolEdit(db, userId, parentId, editSession);
	await db.execute({
		sql: "UPDATE protocol_items SET value = ? WHERE id = ?",
		args: [JSON.stringify(value), itemId],
	});
	// Closing the meeting closes the protocol.
	if (item.type === "close") await markClosed(db, parentId);
}

async function markClosed(db: Client, protocolId: string) {
	await db.execute({
		sql: "UPDATE protocols SET closed_at = ? WHERE id = ? AND closed_at IS NULL",
		args: [new Date().toISOString(), protocolId],
	});
}

/** For protocols without a closing point: close it by hand. */
export async function closeProtocol(
	db: Client,
	userId: string,
	protocolId: string,
) {
	await requireParent(db, userId, "protocol", protocolId);
	await markClosed(db, protocolId);
}
