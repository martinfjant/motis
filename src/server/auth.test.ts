import { createClient } from "@libsql/client";
import { beforeEach, expect, test } from "vitest";
import {
	AuthError,
	authenticate,
	createSession,
	createUser,
	deleteSession,
	getSessionUser,
} from "./auth.server";
import { migrate } from "./migrate";

let db: ReturnType<typeof createClient>;
beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
});

const input = {
	name: "Anna",
	email: "Anna@Example.se",
	password: "hemligt123",
};

test("sign up normalises email and rejects duplicates", async () => {
	const user = await createUser(db, input);
	expect(user.email).toBe("anna@example.se");
	await expect(createUser(db, input)).rejects.toThrow(AuthError);
});

test("sign up validates input", async () => {
	await expect(createUser(db, { ...input, password: "kort" })).rejects.toThrow(
		AuthError,
	);
	await expect(createUser(db, { ...input, email: "nope" })).rejects.toThrow(
		AuthError,
	);
});

test("authenticate accepts the right password only", async () => {
	await createUser(db, input);
	const user = await authenticate(db, " anna@example.se ", "hemligt123");
	expect(user.name).toBe("Anna");
	await expect(authenticate(db, "anna@example.se", "fel")).rejects.toThrow(
		AuthError,
	);
	await expect(authenticate(db, "x@example.se", "hemligt123")).rejects.toThrow(
		AuthError,
	);
});

test("sessions resolve to the user and can be deleted", async () => {
	const user = await createUser(db, input);
	const { token } = await createSession(db, user.id);
	expect((await getSessionUser(db, token))?.id).toBe(user.id);
	expect(await getSessionUser(db, "garbage")).toBeNull();
	await deleteSession(db, token);
	expect(await getSessionUser(db, token)).toBeNull();
});

test("expired sessions are rejected", async () => {
	const user = await createUser(db, input);
	const { token } = await createSession(db, user.id);
	await db.execute(
		"UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'",
	);
	expect(await getSessionUser(db, token)).toBeNull();
});
