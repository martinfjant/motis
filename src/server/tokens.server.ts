import { createHash, randomBytes } from "node:crypto";
import type { Client } from "@libsql/client";

// One-time links sent by email. The token goes in the link; only its hash
// is stored (see email_tokens in migration 0013).

export type TokenPurpose = "verify" | "reset" | "review";

export type TokenInfo = {
	purpose: TokenPurpose;
	subjectId: string;
	email: string;
	expiresAt: string;
};

const hash = (token: string) =>
	createHash("sha256").update(token).digest("base64url");

/**
 * Creates a link token for `subjectId`, valid for `minutes`. Earlier unused
 * tokens for the same purpose and subject stop working, so only the newest
 * link does (asking for a new password twice leaves one working link).
 */
export async function createToken(
	db: Client,
	input: {
		purpose: TokenPurpose;
		subjectId: string;
		email: string;
		minutes: number;
	},
	now = new Date(),
): Promise<string> {
	const token = randomBytes(32).toString("base64url");
	const expires = new Date(now.getTime() + input.minutes * 60_000);
	await db.batch(
		[
			{
				sql: "DELETE FROM email_tokens WHERE purpose = ? AND subject_id = ? AND used_at IS NULL",
				args: [input.purpose, input.subjectId],
			},
			{
				sql: `INSERT INTO email_tokens (token_hash, purpose, subject_id, email, expires_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
				args: [
					hash(token),
					input.purpose,
					input.subjectId,
					input.email,
					expires.toISOString(),
					now.toISOString(),
				],
			},
		],
		"write",
	);
	return token;
}

const toInfo = (r: Record<string, unknown>): TokenInfo => ({
	purpose: r.purpose as TokenPurpose,
	subjectId: String(r.subject_id),
	email: String(r.email),
	expiresAt: String(r.expires_at),
});

/**
 * What a token is for, if it is for `purpose`, unused and not expired.
 * Doesn't use it up: for showing a page before the person acts on it.
 */
export async function checkToken(
	db: Client,
	purpose: TokenPurpose,
	token: string,
	now = new Date(),
): Promise<TokenInfo | null> {
	if (!token) return null;
	const res = await db.execute({
		sql: `SELECT * FROM email_tokens
          WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?`,
		args: [hash(token), purpose, now.toISOString()],
	});
	return res.rows[0] ? toInfo(res.rows[0]) : null;
}

/**
 * Uses up a token: returns what it is for, or null if it is wrong, expired
 * or already used. Two requests with the same token can't both succeed.
 */
export async function redeemToken(
	db: Client,
	purpose: TokenPurpose,
	token: string,
	now = new Date(),
): Promise<TokenInfo | null> {
	if (!token) return null;
	const res = await db.execute({
		sql: `UPDATE email_tokens SET used_at = ?
          WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?
          RETURNING *`,
		args: [now.toISOString(), hash(token), purpose, now.toISOString()],
	});
	return res.rows[0] ? toInfo(res.rows[0]) : null;
}
