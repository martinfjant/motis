import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { hashPassword, verifyPassword } from "./password.server";

export const SESSION_DAYS = 30;

export type User = {
	id: string;
	email: string;
	name: string;
	/** The user has confirmed the address through a link sent to it. */
	emailVerified: boolean;
};

const toUser = (r: Record<string, unknown>): User => ({
	id: String(r.id),
	email: String(r.email),
	name: String(r.name),
	emailVerified: r.email_verified_at != null,
});

export class AuthError extends Error {}

const hashToken = (token: string) =>
	createHash("sha256").update(token).digest("hex");

export function validateSignUp(input: {
	name: string;
	email: string;
	password: string;
}) {
	const name = input.name.trim();
	const email = input.email.trim().toLowerCase();
	if (!name) throw new AuthError("Ange ditt namn.");
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		throw new AuthError("Ange en giltig e-postadress.");
	if (input.password.length < 8)
		throw new AuthError("Lösenordet måste vara minst 8 tecken.");
	return { name, email, password: input.password };
}

export async function createUser(
	db: Client,
	input: { name: string; email: string; password: string },
): Promise<User> {
	const { name, email, password } = validateSignUp(input);
	const existing = await db.execute({
		sql: "SELECT 1 FROM users WHERE email = ?",
		args: [email],
	});
	if (existing.rows.length > 0)
		throw new AuthError("Det finns redan ett konto med den e-postadressen.");
	const id = randomUUID();
	await db.execute({
		sql: "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)",
		args: [id, email, name, await hashPassword(password)],
	});
	return { id, email, name, emailVerified: false };
}

export async function authenticate(
	db: Client,
	emailInput: string,
	password: string,
): Promise<User> {
	const res = await db.execute({
		sql: "SELECT id, email, name, email_verified_at, password_hash FROM users WHERE email = ?",
		args: [emailInput.trim().toLowerCase()],
	});
	const row = res.rows[0];
	// Always run a verification so timing doesn't reveal whether the email exists.
	const hash = row ? String(row.password_hash) : "scrypt$AAAA$AAAA";
	const ok = await verifyPassword(password, hash);
	if (!row || !ok) throw new AuthError("Fel e-postadress eller lösenord.");
	return toUser(row);
}

/** Returns the raw token to put in the cookie; only its hash is stored. */
export async function createSession(db: Client, userId: string) {
	const token = randomBytes(32).toString("base64url");
	const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
	await db.execute({
		sql: "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
		args: [hashToken(token), userId, expires.toISOString()],
	});
	return { token, expires };
}

export async function getSessionUser(
	db: Client,
	token: string | undefined,
): Promise<User | null> {
	if (!token) return null;
	const res = await db.execute({
		sql: `SELECT u.id, u.email, u.name, u.email_verified_at, s.expires_at
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = ?`,
		args: [hashToken(token)],
	});
	const row = res.rows[0];
	if (!row) return null;
	if (new Date(String(row.expires_at)) < new Date()) {
		await deleteSession(db, token);
		return null;
	}
	return toUser(row);
}

export async function deleteSession(db: Client, token: string | undefined) {
	if (!token) return;
	await db.execute({
		sql: "DELETE FROM sessions WHERE id = ?",
		args: [hashToken(token)],
	});
}

/**
 * Changes the user's name and email. The email is what they log in with, so
 * changing it requires the current password, and a new address is
 * unconfirmed until the user follows the link sent to it.
 */
export async function updateProfile(
	db: Client,
	userId: string,
	input: { name: string; email: string; currentPassword: string },
): Promise<User> {
	const name = input.name.trim();
	const email = input.email.trim().toLowerCase();
	if (!name) throw new AuthError("Ange ditt namn.");
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		throw new AuthError("Ange en giltig e-postadress.");

	const res = await db.execute({
		sql: "SELECT email, email_verified_at, password_hash FROM users WHERE id = ?",
		args: [userId],
	});
	const row = res.rows[0];
	if (!row) throw new AuthError("Kontot finns inte.");

	if (email !== String(row.email)) {
		if (
			!(await verifyPassword(input.currentPassword, String(row.password_hash)))
		)
			throw new AuthError(
				"Fel lösenord. Ange ditt nuvarande lösenord för att byta e-postadress.",
			);
		const taken = await db.execute({
			sql: "SELECT 1 FROM users WHERE email = ? AND id != ?",
			args: [email, userId],
		});
		if (taken.rows.length > 0)
			throw new AuthError("Det finns redan ett konto med den e-postadressen.");
	}

	const changed = email !== String(row.email);
	await db.execute({
		sql: `UPDATE users SET name = ?, email = ?,
            email_verified_at = CASE WHEN ? THEN NULL ELSE email_verified_at END
          WHERE id = ?`,
		args: [name, email, changed ? 1 : 0, userId],
	});
	return {
		id: userId,
		name,
		email,
		emailVerified: !changed && row.email_verified_at != null,
	};
}
