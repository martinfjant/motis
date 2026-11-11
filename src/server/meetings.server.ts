import type { Client } from "@libsql/client";
import { daysBetween, formatMeetingAt, stockholmStamp } from "../meeting-time";
import {
	type AgendaDetails,
	type CarriedItem,
	createAgenda,
} from "./agendas.server";
import { listBoards, requireMember } from "./boards.server";
import { canCarryOver, type ItemType, type ProtocolItem } from "./items";
import { listProtocolItems } from "./protocols.server";

// How one meeting leads to the next: the latest protocol says when the next
// meeting is, and which of its points were tabled or are to be followed up.

export type CarryOver = {
	/** The protocol point it comes from. */
	itemId: string;
	title: string;
	type: ItemType;
	reason: "tabled" | "followUp";
	/** The description it gets on the new agenda. */
	description: string;
};

export type MeetingPlan = {
	/** The previous meeting, if the board has had one. */
	previous: { id: string; title: string; meetingAt: string } | null;
	/**
	 * When the previous meeting said the next one is, unless that has already
	 * been called or is in the past. "" if unknown.
	 */
	nextAt: string;
	/** Where the previous meeting was held, as a starting point. */
	location: string;
	/** Points to bring to the next agenda, not yet on any agenda. */
	carryOver: CarryOver[];
};

const NO_PLAN: MeetingPlan = {
	previous: null,
	nextAt: "",
	location: "",
	carryOver: [],
};

function meetingName(p: { title: string; meetingAt: string }) {
	return p.meetingAt
		? `mötet ${formatMeetingAt(p.meetingAt.slice(0, 10))}`
		: `mötet ”${p.title}”`;
}

function carriedDescription(
	item: ProtocolItem,
	reason: CarryOver["reason"],
	from: { title: string; meetingAt: string },
) {
	const v = item.value;
	return [
		reason === "tabled"
			? `Bordlagd vid ${meetingName(from)}.`
			: `Uppföljning från ${meetingName(from)}.`,
		item.description,
		v.decision ? `Beslut: ${v.decision}` : "",
		v.notes ?? "",
	]
		.map((part) => part.trim())
		.filter(Boolean)
		.join("\n\n");
}

/** What the board's next agenda should start from. */
export async function getMeetingPlan(
	db: Client,
	userId: string,
	boardId: string,
	now = new Date(),
): Promise<MeetingPlan> {
	await requireMember(db, userId, boardId);
	const res = await db.execute({
		sql: `SELECT id, title, meeting_at, location FROM protocols WHERE board_id = ?
          ORDER BY meeting_at DESC, created_at DESC LIMIT 1`,
		args: [boardId],
	});
	const row = res.rows[0];
	if (!row) return NO_PLAN;
	const previous = {
		id: String(row.id),
		title: String(row.title),
		meetingAt: String(row.meeting_at),
	};
	const items = await listProtocolItems(db, previous.id);

	// The next meeting counts as called once an agenda exists for a time
	// after the previous meeting.
	const plannedAt =
		items.find((i) => i.type === "next_meeting" && i.value.at)?.value.at ?? "";
	const called = await db.execute({
		sql: "SELECT 1 FROM agendas WHERE board_id = ? AND meeting_at != '' AND meeting_at > ? LIMIT 1",
		args: [boardId, previous.meetingAt],
	});
	const today = stockholmStamp(now).slice(0, 10);
	const nextAt =
		plannedAt && plannedAt.slice(0, 10) >= today && called.rows.length === 0
			? plannedAt
			: "";

	const flagged = items.filter(
		(i) => canCarryOver(i.type) && (i.value.tabled || i.value.followUp),
	);
	const done = new Set<string>();
	if (flagged.length > 0) {
		const carried = await db.execute({
			sql: `SELECT source_item_id FROM agenda_items
            WHERE source_item_id IN (${flagged.map(() => "?").join(", ")})`,
			args: flagged.map((i) => i.id),
		});
		for (const r of carried.rows) done.add(String(r.source_item_id));
	}

	return {
		previous,
		nextAt,
		location: String(row.location),
		carryOver: flagged
			.filter((i) => !done.has(i.id))
			.map((i) => {
				const reason = i.value.tabled ? "tabled" : "followUp";
				return {
					itemId: i.id,
					title: i.title,
					type: i.type,
					reason,
					description: carriedDescription(i, reason, previous),
				};
			}),
	};
}

/**
 * "Kalla till möte": creates the agenda from a template plus the chosen
 * points from the previous meeting. Only points the plan offers can be
 * chosen, so nothing from another board or already carried slips in.
 */
export async function callMeeting(
	db: Client,
	userId: string,
	boardId: string,
	input: AgendaDetails & { templateId?: string; carryOver: string[] },
) {
	const plan = await getMeetingPlan(db, userId, boardId);
	const carried: CarriedItem[] = plan.carryOver
		.filter((c) => input.carryOver.includes(c.itemId))
		.map((c) => ({
			title: c.title,
			type: c.type,
			description: c.description,
			sourceItemId: c.itemId,
		}));
	return createAgenda(db, userId, boardId, { ...input, carried });
}

/** Today's date in Sweden, "YYYY-MM-DD". */
export const today = (now = new Date()) => stockholmStamp(now).slice(0, 10);

export type UpcomingMeeting = {
	boardId: string;
	boardName: string;
	meetingAt: string;
	daysUntil: number;
	/** The agenda if the meeting has been called; null if only planned. */
	agenda: { id: string; title: string } | null;
};

/**
 * The user's coming meetings on all their boards, soonest first: called
 * meetings (agendas not yet started) and meetings only planned in the
 * latest protocol.
 */
export async function listUpcoming(
	db: Client,
	userId: string,
	boardId?: string,
	now = new Date(),
): Promise<UpcomingMeeting[]> {
	const today = stockholmStamp(now).slice(0, 10);
	const boards = (await listBoards(db, userId)).filter(
		(b) => !boardId || b.id === boardId,
	);
	const meetings: UpcomingMeeting[] = [];
	for (const board of boards) {
		const res = await db.execute({
			sql: `SELECT a.id, a.title, a.meeting_at FROM agendas a
            LEFT JOIN protocols p ON p.agenda_id = a.id
            WHERE a.board_id = ? AND p.id IS NULL AND a.meeting_at >= ?`,
			args: [board.id, today],
		});
		for (const r of res.rows)
			meetings.push({
				boardId: board.id,
				boardName: board.name,
				meetingAt: String(r.meeting_at),
				daysUntil: daysBetween(today, String(r.meeting_at)),
				agenda: { id: String(r.id), title: String(r.title) },
			});
		const plan = await getMeetingPlan(db, userId, board.id, now);
		if (plan.nextAt)
			meetings.push({
				boardId: board.id,
				boardName: board.name,
				meetingAt: plan.nextAt,
				daysUntil: daysBetween(today, plan.nextAt),
				agenda: null,
			});
	}
	return meetings.sort((a, b) => a.meetingAt.localeCompare(b.meetingAt));
}
