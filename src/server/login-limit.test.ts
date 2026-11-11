import { createClient } from "@libsql/client";
import { beforeEach, expect, test } from "vitest";
import { AuthError, createUser } from "./auth.server";
import {
	logInWithLimit,
	MAX_PER_EMAIL,
	MAX_PER_IP,
	WINDOW_MINUTES,
} from "./login-limit.server";
import { migrate } from "./migrate";

let db: ReturnType<typeof createClient>;
beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	await createUser(db, {
		name: "Anna",
		email: "anna@example.se",
		password: "hemligt123",
	});
});

const t0 = new Date("2026-11-11T12:00:00Z");
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
const wrong = { email: "anna@example.se", password: "fel", ip: "1.2.3.4" };
const right = { ...wrong, password: "hemligt123" };

async function failTimes(n: number, input = wrong, now = t0) {
	for (let i = 0; i < n; i++)
		await expect(logInWithLimit(db, input, now)).rejects.toThrow(
			"Fel e-postadress eller lösenord.",
		);
}

test("blocks an email after too many failures, even with the right password", async () => {
	await failTimes(MAX_PER_EMAIL);
	await expect(logInWithLimit(db, right, t0)).rejects.toThrow(
		`Försök igen om ${WINDOW_MINUTES} minuter`,
	);
	// Same email from another address, differently cased, is still blocked.
	await expect(
		logInWithLimit(
			db,
			{ ...right, email: " ANNA@example.se", ip: "9.9.9.9" },
			t0,
		),
	).rejects.toThrow(AuthError);
});

test("the block lifts when the window has passed", async () => {
	await failTimes(MAX_PER_EMAIL);
	await expect(
		logInWithLimit(db, right, later(WINDOW_MINUTES - 1)),
	).rejects.toThrow("Försök igen om 1 minut.");
	const user = await logInWithLimit(db, right, later(WINDOW_MINUTES));
	expect(user.name).toBe("Anna");
});

test("blocked attempts don't extend the lockout", async () => {
	await failTimes(MAX_PER_EMAIL);
	for (let m = 1; m < WINDOW_MINUTES; m++)
		await expect(logInWithLimit(db, wrong, later(m))).rejects.toThrow(
			"För många",
		);
	expect((await logInWithLimit(db, right, later(WINDOW_MINUTES))).name).toBe(
		"Anna",
	);
});

test("a successful login forgives earlier failures", async () => {
	await failTimes(MAX_PER_EMAIL - 1);
	await logInWithLimit(db, right, t0);
	await failTimes(MAX_PER_EMAIL - 1);
	await logInWithLimit(db, right, t0);
});

test("unknown emails are limited the same way", async () => {
	const ghost = { ...wrong, email: "finns-inte@example.se" };
	await failTimes(MAX_PER_EMAIL, ghost);
	await expect(logInWithLimit(db, ghost, t0)).rejects.toThrow("För många");
});

test("blocks an IP address trying many different emails", async () => {
	for (let i = 0; i < MAX_PER_IP; i++)
		await failTimes(1, { ...wrong, email: `person${i}@example.se` });
	await expect(logInWithLimit(db, right, t0)).rejects.toThrow("För många");
	// Another address is unaffected.
	expect((await logInWithLimit(db, { ...right, ip: "5.6.7.8" }, t0)).name).toBe(
		"Anna",
	);
});

test("parallel attempts can't slip past the limit", async () => {
	const results = await Promise.allSettled(
		Array.from({ length: 30 }, () => logInWithLimit(db, wrong, t0)),
	);
	const checked = results.filter(
		(r) => r.status === "rejected" && /Fel e-post/.test(String(r.reason)),
	);
	expect(checked.length).toBeLessThanOrEqual(MAX_PER_EMAIL);
});
