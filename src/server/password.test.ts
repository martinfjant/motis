import { scryptSync } from "node:crypto";
import { createClient } from "@libsql/client";
import { expect, test } from "vitest";
import { authenticate, createUser } from "./auth.server";
import { migrate } from "./migrate";
import {
	COST,
	hashPassword,
	NO_ACCOUNT_HASH,
	needsRehash,
	verifyPassword,
} from "./password.server";

/** A hash as stored before the cost was part of it. */
function legacyHash(password: string) {
	const salt = Buffer.from("0123456789abcdef");
	const key = scryptSync(password, salt, 64);
	return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

test("hashes carry their cost and verify", async () => {
	const hash = await hashPassword("hemligt123");
	expect(hash).toMatch(
		new RegExp(`^scrypt\\$${COST.N}\\$${COST.r}\\$${COST.p}\\$`),
	);
	expect(await verifyPassword("hemligt123", hash)).toBe(true);
	expect(await verifyPassword("hemligt124", hash)).toBe(false);
	expect(needsRehash(hash)).toBe(false);
});

test("old hashes still verify, and are due to be remade", async () => {
	const old = legacyHash("hemligt123");
	expect(await verifyPassword("hemligt123", old)).toBe(true);
	expect(await verifyPassword("fel", old)).toBe(false);
	expect(needsRehash(old)).toBe(true);
});

test("a stored hash can't ask for unreasonable settings", async () => {
	expect(await verifyPassword("x", "scrypt$1073741824$8$1$AAAA$AAAA")).toBe(
		false,
	);
	expect(await verifyPassword("x", "bcrypt$AAAA$AAAA")).toBe(false);
	expect(await verifyPassword("x", NO_ACCOUNT_HASH)).toBe(false);
});

test("logging in remakes an old hash with the current settings", async () => {
	const db = createClient({ url: ":memory:" });
	await migrate(db);
	const user = await createUser(db, {
		name: "Anna",
		email: "anna@example.se",
		password: "hemligt123",
	});
	await db.execute({
		sql: "UPDATE users SET password_hash = ? WHERE id = ?",
		args: [legacyHash("hemligt123"), user.id],
	});
	await authenticate(db, "anna@example.se", "hemligt123");
	const { rows } = await db.execute({
		sql: "SELECT password_hash FROM users WHERE id = ?",
		args: [user.id],
	});
	const stored = String(rows[0].password_hash);
	expect(needsRehash(stored)).toBe(false);
	expect(await verifyPassword("hemligt123", stored)).toBe(true);
});
