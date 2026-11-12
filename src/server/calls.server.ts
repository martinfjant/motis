import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { listItems, requireParent } from "./agendas.server";
import { BoardError, listMembers, listUnregistered } from "./boards.server";
import { personLabel } from "./items";
import { appUrl, sendMail } from "./mail/send.server";
import { callMail } from "./mail/templates.server";

// "Skicka kallelse": the agenda emailed to everyone on the board, with the
// link to the shared agenda.

export type CallRecipient = { name: string; email: string };

/** A kallelse that was sent. */
export type SentCall = {
	sentAt: string;
	sentByName: string;
	recipients: CallRecipient[];
};

/**
 * Who gets the kallelse: everyone on the board with an email address,
 * with and without account. `missing` are those without one, by name.
 */
async function recipientsFor(db: Client, userId: string, boardId: string) {
	const [members, unregistered] = await Promise.all([
		listMembers(db, userId, boardId),
		listUnregistered(db, userId, boardId),
	]);
	const people = [...members, ...unregistered]
		.map((m) => ({ name: personLabel(m.name, m.title), email: m.email }))
		.sort((a, b) => a.name.localeCompare(b.name, "sv"));
	return {
		recipients: people.filter((p) => p.email),
		missing: people.filter((p) => !p.email).map((p) => p.name),
	};
}

/** Kallelser sent for the agenda, newest first. */
async function listCalls(db: Client, agendaId: string): Promise<SentCall[]> {
	const res = await db.execute({
		sql: "SELECT * FROM agenda_calls WHERE agenda_id = ? ORDER BY sent_at DESC",
		args: [agendaId],
	});
	return res.rows.map((r) => ({
		sentAt: String(r.sent_at),
		sentByName: String(r.sent_by_name),
		recipients: JSON.parse(String(r.recipients)) as CallRecipient[],
	}));
}

/** For the agenda page: who would get the kallelse, and what has been sent. */
export async function getCallStatus(
	db: Client,
	userId: string,
	agendaId: string,
) {
	const { board } = await requireParent(db, userId, "agenda", agendaId);
	return {
		...(await recipientsFor(db, userId, board.id)),
		sent: await listCalls(db, agendaId),
	};
}

/**
 * Emails the kallelse to everyone on the board who has an address, one
 * email each. Only before the meeting has started: after that the
 * protocol is what counts.
 */
export async function sendCall(
	db: Client,
	userId: string,
	agendaId: string,
	now = new Date(),
): Promise<void> {
	const { row, board } = await requireParent(db, userId, "agenda", agendaId);
	const started = await db.execute({
		sql: "SELECT 1 FROM protocols WHERE agenda_id = ?",
		args: [agendaId],
	});
	if (started.rows.length > 0) throw new BoardError("Mötet har redan startat.");
	const { recipients } = await recipientsFor(db, userId, board.id);
	if (recipients.length === 0)
		throw new BoardError("Ingen i styrelsen har en e-postadress.");

	const sender = await db.execute({
		sql: "SELECT name FROM users WHERE id = ?",
		args: [userId],
	});
	const senderName = String(sender.rows[0]?.name ?? "");
	const items = await listItems(db, "agenda", agendaId);
	const agenda = {
		title: String(row.title),
		meetingAt: String(row.meeting_at),
		location: String(row.location),
	};
	const url = appUrl(`/dagordning/${String(row.share_id)}`);
	for (const r of recipients)
		await sendMail(
			db,
			callMail({
				to: r.email,
				senderName,
				boardName: board.name,
				agenda,
				items,
				url,
			}),
		);
	await db.execute({
		sql: `INSERT INTO agenda_calls (id, agenda_id, sent_at, sent_by, sent_by_name, recipients)
          VALUES (?, ?, ?, ?, ?, ?)`,
		args: [
			randomUUID(),
			agendaId,
			now.toISOString(),
			userId,
			senderName,
			JSON.stringify(recipients),
		],
	});
}
