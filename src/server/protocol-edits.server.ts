import type { Client } from "@libsql/client";
import { BoardError } from "./boards.server";
import { personLabel } from "./items";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Call before changing anything in a protocol. Open protocols can be changed
 * freely. A closed protocol can only be changed within an editing session
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
	if (res.rows[0]?.closed_at == null) return;
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
