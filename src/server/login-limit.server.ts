import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { AuthError, authenticate, type User } from "./auth.server";

export const WINDOW_MINUTES = 15;
/** Failed attempts allowed per email address within the window. */
export const MAX_PER_EMAIL = 5;
/**
 * Failed attempts allowed per IP address within the window. Higher than the
 * per-email limit, since several people can share an address (same network).
 */
export const MAX_PER_IP = 20;

/**
 * Logs in like `authenticate`, but refuses once an email or IP address has
 * too many failed attempts within the window.
 *
 * The attempt is recorded before the password is checked, so parallel
 * requests can't all slip past the count. Blocked attempts are not kept,
 * which means someone hammering an account can't extend its lockout beyond
 * the window. Attempts are counted whether or not the account exists.
 */
export async function logInWithLimit(
	db: Client,
	input: { email: string; password: string; ip: string | undefined },
	now = new Date(),
): Promise<User> {
	const email = input.email.trim().toLowerCase();
	const keys = [
		{ key: `email:${email}`, max: MAX_PER_EMAIL },
		...(input.ip ? [{ key: `ip:${input.ip}`, max: MAX_PER_IP }] : []),
	];
	const cutoff = new Date(
		now.getTime() - WINDOW_MINUTES * 60_000,
	).toISOString();
	const attemptId = randomUUID();

	await db.execute({
		sql: "DELETE FROM login_attempts WHERE attempted_at <= ?",
		args: [cutoff],
	});
	for (const { key } of keys)
		await db.execute({
			sql: "INSERT INTO login_attempts (attempt_id, key, attempted_at) VALUES (?, ?, ?)",
			args: [attemptId, key, now.toISOString()],
		});

	for (const { key, max } of keys) {
		const res = await db.execute({
			sql: `SELECT COUNT(*) AS n, MIN(attempted_at) AS oldest
            FROM login_attempts WHERE key = ? AND attempted_at > ?`,
			args: [key, cutoff],
		});
		const n = Number(res.rows[0].n);
		if (n > max) {
			await forget(db, attemptId);
			const freeAt =
				new Date(String(res.rows[0].oldest)).getTime() +
				WINDOW_MINUTES * 60_000;
			const minutes = Math.max(1, Math.ceil((freeAt - now.getTime()) / 60_000));
			throw new AuthError(
				`För många inloggningsförsök. Försök igen om ${minutes} ${minutes === 1 ? "minut" : "minuter"}.`,
			);
		}
	}

	try {
		const user = await authenticate(db, email, input.password);
		// Success: this attempt doesn't count, and the account's earlier
		// failures are forgiven.
		await forget(db, attemptId);
		await db.execute({
			sql: "DELETE FROM login_attempts WHERE key = ?",
			args: [`email:${email}`],
		});
		return user;
	} catch (err) {
		if (!(err instanceof AuthError)) await forget(db, attemptId);
		throw err;
	}
}

function forget(db: Client, attemptId: string) {
	return db.execute({
		sql: "DELETE FROM login_attempts WHERE attempt_id = ?",
		args: [attemptId],
	});
}
