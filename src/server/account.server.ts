import type { Client } from "@libsql/client";
import { AuthError, type User, validateSignUp } from "./auth.server";
import { appUrl, MailError, sendMail } from "./mail/send.server";
import { passwordResetMail, verifyEmailMail } from "./mail/templates.server";
import { hashPassword } from "./password.server";
import { checkToken, createToken, redeemToken } from "./tokens.server";

// Email links for the account: confirming the address, and setting a new
// password when the old one is forgotten.

/** How long the confirmation link works. */
export const VERIFY_LINK_HOURS = 48;
/** How long a password link works; short, since it gives the account. */
export const RESET_LINK_MINUTES = 60;
/** At most one email of each kind per account this often. */
const RESEND_SECONDS = 60;

/** Whether an email of this kind went to the user very recently. */
async function sentRecently(
	db: Client,
	purpose: "verify" | "reset",
	userId: string,
	now: Date,
) {
	const res = await db.execute({
		sql: "SELECT 1 FROM email_tokens WHERE purpose = ? AND subject_id = ? AND created_at > ?",
		args: [
			purpose,
			userId,
			new Date(now.getTime() - RESEND_SECONDS * 1000).toISOString(),
		],
	});
	return res.rows.length > 0;
}

/**
 * Emails the user a link that confirms their address. Does nothing if it
 * is already confirmed, or if a link was just sent.
 */
export async function sendVerification(
	db: Client,
	user: User,
	now = new Date(),
): Promise<void> {
	if (user.emailVerified) return;
	if (await sentRecently(db, "verify", user.id, now)) return;
	const token = await createToken(
		db,
		{
			purpose: "verify",
			subjectId: user.id,
			email: user.email,
			minutes: VERIFY_LINK_HOURS * 60,
		},
		now,
	);
	await sendMail(
		db,
		verifyEmailMail({
			to: user.email,
			name: user.name,
			url: appUrl(`/bekrafta/${token}`),
			hours: VERIFY_LINK_HOURS,
		}),
	);
}

/**
 * Marks the address as the user's own. Anyone added to a board without an
 * account under this address now becomes a member with it (keeping their
 * title): the address proves it is the same person. Returns the names of
 * the boards they joined that way.
 */
async function markVerified(
	db: Client,
	userId: string,
	email: string,
	now: Date,
): Promise<string[]> {
	const waiting = await db.execute({
		sql: `SELECT r.id, r.board_id, r.title, b.name AS board_name
          FROM board_unregistered_members r JOIN boards b ON b.id = r.board_id
          WHERE r.email = ?`,
		args: [email],
	});
	await db.batch(
		[
			{
				sql: "UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?",
				args: [now.toISOString(), userId],
			},
			...waiting.rows.flatMap((r) => [
				{
					sql: `INSERT INTO board_memberships (board_id, user_id, role, title)
                VALUES (?, ?, 'member', ?) ON CONFLICT DO NOTHING`,
					args: [r.board_id, userId, r.title],
				},
				{
					sql: "DELETE FROM board_unregistered_members WHERE id = ?",
					args: [r.id],
				},
			]),
		],
		"write",
	);
	return waiting.rows.map((r) => String(r.board_name));
}

/** The user a token's subject is, if they still have the address it was sent to. */
async function userForToken(db: Client, userId: string, email: string) {
	const res = await db.execute({
		sql: "SELECT id, email FROM users WHERE id = ? AND email = ?",
		args: [userId, email],
	});
	return res.rows[0] ? String(res.rows[0].id) : null;
}

/**
 * Follows a confirmation link. Null if the link is wrong, used, expired or
 * for an address the account no longer has.
 */
export async function verifyEmail(
	db: Client,
	token: string,
	now = new Date(),
): Promise<{ joinedBoards: string[] } | null> {
	const info = await redeemToken(db, "verify", token, now);
	if (!info) return null;
	const userId = await userForToken(db, info.subjectId, info.email);
	if (!userId) return null;
	return { joinedBoards: await markVerified(db, userId, info.email, now) };
}

/**
 * "Glömt lösenordet": emails a link for setting a new password, if there is
 * an account with the address. Whether there is one is not revealed, and
 * at most one email goes out per minute.
 */
export async function requestPasswordReset(
	db: Client,
	emailInput: string,
	now = new Date(),
): Promise<void> {
	const email = emailInput.trim().toLowerCase();
	const res = await db.execute({
		sql: "SELECT id, name FROM users WHERE email = ?",
		args: [email],
	});
	const row = res.rows[0];
	if (!row) return;
	const userId = String(row.id);
	if (await sentRecently(db, "reset", userId, now)) return;
	const token = await createToken(
		db,
		{ purpose: "reset", subjectId: userId, email, minutes: RESET_LINK_MINUTES },
		now,
	);
	try {
		await sendMail(
			db,
			passwordResetMail({
				to: email,
				name: String(row.name),
				url: appUrl(`/nytt-losenord/${token}`),
				minutes: RESET_LINK_MINUTES,
			}),
		);
	} catch (err) {
		// An error here would reveal that the account exists; the answer
		// stays the same, and the person can ask again.
		if (!(err instanceof MailError)) throw err;
		console.error("Password reset email not sent:", err.message);
	}
}

/** Whether a password link still works, to show the form or say it doesn't. */
export async function checkPasswordReset(
	db: Client,
	token: string,
	now = new Date(),
): Promise<boolean> {
	return (await checkToken(db, "reset", token, now)) !== null;
}

/**
 * Sets a new password through the emailed link. Logs the account out
 * everywhere (whoever knew the old password is out) and confirms the
 * address, since the link proves access to it. Returns the user id, to log
 * in with.
 */
export async function resetPassword(
	db: Client,
	token: string,
	password: string,
	now = new Date(),
): Promise<string> {
	// Same rules as when signing up.
	validateSignUp({ name: "-", email: "a@b.se", password });
	const info = await redeemToken(db, "reset", token, now);
	const userId = info && (await userForToken(db, info.subjectId, info.email));
	if (!info || !userId)
		throw new AuthError(
			"Länken fungerar inte längre. Be om en ny under ”Glömt lösenordet?”.",
		);
	await db.batch(
		[
			{
				sql: "UPDATE users SET password_hash = ? WHERE id = ?",
				args: [await hashPassword(password), userId],
			},
			{ sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] },
		],
		"write",
	);
	await markVerified(db, userId, info.email, now);
	return userId;
}
