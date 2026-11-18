import type { Client } from "@libsql/client";
import { BoardError } from "./boards.server";
import { personLabel } from "./items";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Call before changing anything in a protocol. An open protocol (the meeting
 * is going on) can be changed by the tab writing it (see holdProtocol). A
 * closed protocol can only be changed within an editing session
 * (a random id the client creates when "Redigera protokollet" is clicked),
 * and the session is recorded so the protocol shows it was edited, by whom
 * and when.
 */
export async function guardProtocolEdit(
	db: Client,
	userId: string,
	protocolId: string,
	editSession: string | undefined,
) {
	const res = await db.execute({
		sql: "SELECT closed_at FROM protocols WHERE id = ?",
		args: [protocolId],
	});
	if (!res.rows[0]) return;
	if (res.rows[0].closed_at == null) {
		// During the meeting only the tab writing the protocol may change it.
		const holds = await holdProtocol(db, userId, protocolId, editSession);
		if (!holds) {
			const editor = await activeEditor(db, protocolId);
			throw new BoardError(
				`${editor?.name ?? "Någon annan"} skriver protokollet just nu, så ändringen sparades inte.`,
			);
		}
		return;
	}
	if (!editSession || !UUID.test(editSession))
		throw new BoardError(
			"Protokollet är stängt. Välj ”Redigera protokollet” för att ändra det.",
		);
	// The editor as written in the protocol, with their title on this board.
	const user = await db.execute({
		sql: `SELECT u.name, m.title FROM users u
          JOIN protocols p ON p.id = ?
          LEFT JOIN board_memberships m ON m.board_id = p.board_id AND m.user_id = u.id
          WHERE u.id = ?`,
		args: [protocolId, userId],
	});
	const logged = await db.execute({
		sql: `INSERT INTO protocol_edits (id, protocol_id, user_id, user_name, edited_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET edited_at = excluded.edited_at
          WHERE protocol_edits.protocol_id = excluded.protocol_id
            AND protocol_edits.user_id = excluded.user_id`,
		args: [
			editSession,
			protocolId,
			userId,
			personLabel(
				String(user.rows[0]?.name ?? ""),
				String(user.rows[0]?.title ?? ""),
			),
			new Date().toISOString(),
		],
	});
	// The id belongs to someone else's session: refuse rather than let the
	// change through unrecorded.
	if (logged.rowsAffected === 0)
		throw new BoardError("Ogiltig redigering. Ladda om sidan och försök igen.");
}

/**
 * A tab that hasn't checked in for this long (ms) has probably been closed,
 * so it no longer holds the protocol. Browsers check in less often from tabs
 * in the background, so this is generous.
 */
export const EDITOR_TIMEOUT = 90_000;

export type Editor = { userId: string; name: string; session: string };

/** Who is writing an open protocol, unless their tab has gone quiet. */
export async function activeEditor(
	db: Client,
	protocolId: string,
	now = new Date(),
): Promise<Editor | null> {
	const res = await db.execute({
		sql: `SELECT editor_session, editor_user_id, editor_name FROM protocols
          WHERE id = ? AND closed_at IS NULL AND editor_session IS NOT NULL
            AND editor_seen_at >= ?`,
		args: [protocolId, new Date(now.getTime() - EDITOR_TIMEOUT).toISOString()],
	});
	const row = res.rows[0];
	return row
		? {
				userId: String(row.editor_user_id),
				name: String(row.editor_name),
				session: String(row.editor_session),
			}
		: null;
}

/**
 * Lets the tab (session, a random id it made) write an open protocol and
 * notes that it is still there. It gets to if it already does, or nobody
 * does; with takeOver, also if someone else does. Returns whether it holds
 * the protocol now. Without a session (older pages) nothing is held, and a
 * change is let through only while nobody else is writing.
 */
export async function holdProtocol(
	db: Client,
	userId: string,
	protocolId: string,
	session: string | undefined,
	{ takeOver = false, now = new Date() } = {},
): Promise<boolean> {
	if (!session || !UUID.test(session))
		return (await activeEditor(db, protocolId, now)) === null;
	const user = await db.execute({
		sql: "SELECT name FROM users WHERE id = ?",
		args: [userId],
	});
	const res = await db.execute({
		sql: `UPDATE protocols
          SET editor_session = ?, editor_user_id = ?, editor_name = ?, editor_seen_at = ?
          WHERE id = ? AND closed_at IS NULL
            AND (? OR editor_session IS NULL OR editor_session = ?
                 OR editor_seen_at IS NULL OR editor_seen_at < ?)`,
		args: [
			session,
			userId,
			String(user.rows[0]?.name ?? ""),
			now.toISOString(),
			protocolId,
			takeOver ? 1 : 0,
			session,
			new Date(now.getTime() - EDITOR_TIMEOUT).toISOString(),
		],
	});
	return res.rowsAffected > 0;
}

/** The tab stops writing the protocol, e.g. when leaving the page. */
export async function releaseProtocol(
	db: Client,
	protocolId: string,
	session: string,
) {
	await db.execute({
		sql: `UPDATE protocols
          SET editor_session = NULL, editor_user_id = NULL, editor_name = NULL, editor_seen_at = NULL
          WHERE id = ? AND editor_session = ?`,
		args: [protocolId, session],
	});
}
