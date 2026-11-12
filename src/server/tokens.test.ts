import { createClient } from "@libsql/client";
import { beforeEach, expect, test } from "vitest";
import { listOutbox, sendMail } from "./mail/send.server";
import { testMail } from "./mail/templates.server";
import { migrate } from "./migrate";
import { checkToken, createToken, redeemToken } from "./tokens.server";

let db: ReturnType<typeof createClient>;
beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
});

const at = (iso: string) => new Date(iso);
const reset = (subjectId: string, now = at("2026-11-12T10:00:00Z")) =>
	createToken(
		db,
		{ purpose: "reset", subjectId, email: "anna@example.se", minutes: 60 },
		now,
	);

test("a token works once, for its purpose, until it expires", async () => {
	const token = await reset("anna");
	const before = at("2026-11-12T10:59:00Z");
	const after = at("2026-11-12T11:00:00Z");

	expect(await checkToken(db, "verify", token, before)).toBeNull();
	expect(await checkToken(db, "reset", "fel", before)).toBeNull();
	expect(await checkToken(db, "reset", "", before)).toBeNull();
	expect(await checkToken(db, "reset", token, after)).toBeNull();
	// Checking doesn't use it up.
	expect(await checkToken(db, "reset", token, before)).toMatchObject({
		purpose: "reset",
		subjectId: "anna",
		email: "anna@example.se",
	});
	expect(await redeemToken(db, "reset", token, after)).toBeNull();
	expect(await redeemToken(db, "reset", token, before)).toMatchObject({
		subjectId: "anna",
	});
	expect(await redeemToken(db, "reset", token, before)).toBeNull();
	expect(await checkToken(db, "reset", token, before)).toBeNull();
});

test("only the newest link for the same thing works", async () => {
	const first = await reset("anna");
	const other = await reset("bo");
	const second = await reset("anna");
	const now = at("2026-11-12T10:30:00Z");
	expect(await checkToken(db, "reset", first, now)).toBeNull();
	expect(await checkToken(db, "reset", second, now)).not.toBeNull();
	expect(await checkToken(db, "reset", other, now)).not.toBeNull();
});

test("only a hash of the token is stored", async () => {
	const token = await reset("anna");
	const rows = await db.execute("SELECT token_hash FROM email_tokens");
	expect(rows.rows).toHaveLength(1);
	expect(String(rows.rows[0].token_hash)).not.toContain(token);
});

test("in development, mail goes to the outbox", async () => {
	await sendMail(db, testMail({ name: "Anna", email: "anna@example.se" }));
	const [mail] = await listOutbox(db);
	expect(mail).toMatchObject({
		to: "anna@example.se",
		subject: "Testmejl från BRF-protokoll",
	});
	expect(mail.html).toMatch(/^<!doctype html><html lang="sv">/);
	expect(mail.html).toContain('href="http://localhost:3000/"');
	expect(mail.text).toContain("Hej Anna!");
});
