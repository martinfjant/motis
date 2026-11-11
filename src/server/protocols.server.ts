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
import { listMembers, requireMember } from "./boards.server";
import type { ItemType, ProtocolItem, ProtocolValue } from "./items";

export type Protocol = {
	id: string;
	boardId: string;
	agendaId: string | null;
	shareId: string;
	title: string;
	meetingAt: string;
	location: string;
};

const toProtocol = (r: Row): Protocol => ({
	id: String(r.id),
	boardId: String(r.board_id),
	agendaId: r.agenda_id == null ? null : String(r.agenda_id),
	shareId: String(r.share_id),
	title: String(r.title),
	meetingAt: String(r.meeting_at),
	location: String(r.location),
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
	return {
		board,
		protocol: toProtocol(row),
		items: await listProtocolItems(db, protocolId),
		/** Board members' names, for attendance and person choices. */
		memberNames: members.map((m) => m.name),
	};
}

export async function updateProtocol(
	db: Client,
	userId: string,
	protocolId: string,
	input: AgendaDetails,
) {
	await requireParent(db, userId, "protocol", protocolId);
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
export async function saveItemValue(
	db: Client,
	userId: string,
	itemId: string,
	input: ProtocolValue,
) {
	const { item } = await requireItem(db, userId, "protocol", itemId);
	await db.execute({
		sql: "UPDATE protocol_items SET value = ? WHERE id = ?",
		args: [JSON.stringify(cleanValue(item.type, input)), itemId],
	});
}
