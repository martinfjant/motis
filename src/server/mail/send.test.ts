import { createClient } from "@libsql/client";
import { afterEach, expect, test, vi } from "vitest";
import { migrate } from "../migrate";
import {
	listOutbox,
	type Mail,
	MailError,
	sendMail,
	sendWithResend,
} from "./send.server";

const mail: Mail = {
	to: "anna@example.se",
	subject: "Kallelse",
	html: "<p>Hej</p>",
	text: "Hej",
	replyTo: "bo@example.se",
};
const config = {
	apiKey: "re_test",
	from: "BRF-protokoll <noreply@mail.example.se>",
};

/** A fake Resend answering with the given responses in turn. */
function fakeResend(...responses: Response[]) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetch = vi.fn(async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		const next = responses.shift();
		if (!next) throw new Error("no more responses");
		return next;
	});
	return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}
const ok = () => Response.json({ id: "49a3999c" });
const err = (status: number, name: string, headers = {}) =>
	Response.json(
		{ statusCode: status, name, message: "nej" },
		{ status, headers },
	);
const noWait = async () => {};

test("an email goes to Resend with the sender, reply-to and both versions", async () => {
	const resend = fakeResend(ok());
	await sendWithResend(config, mail, { fetch: resend.fetch, wait: noWait });
	const [{ url, init }] = resend.calls;
	expect(url).toBe("https://api.resend.com/emails");
	expect(init.method).toBe("POST");
	const headers = init.headers as Record<string, string>;
	expect(headers.Authorization).toBe("Bearer re_test");
	expect(headers["User-Agent"]).toBe("brf-protokoll");
	expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
	expect(JSON.parse(String(init.body))).toEqual({
		from: "BRF-protokoll <noreply@mail.example.se>",
		to: ["anna@example.se"],
		subject: "Kallelse",
		html: "<p>Hej</p>",
		text: "Hej",
		reply_to: "bo@example.se",
	});
});

test("in development every email goes to the developer, marked with its recipient", async () => {
	const resend = fakeResend(ok());
	await sendWithResend({ ...config, devTo: "jag@example.se" }, mail, {
		fetch: resend.fetch,
		wait: noWait,
	});
	const body = JSON.parse(String(resend.calls[0].init.body));
	expect(body.to).toEqual(["jag@example.se"]);
	expect(body.subject).toBe("[till anna@example.se] Kallelse");
});

test("rate limits and temporary errors are retried with the same key", async () => {
	const waits: number[] = [];
	const resend = fakeResend(
		err(429, "rate_limit_exceeded", { "retry-after": "2" }),
		err(503, "service_unavailable"),
		ok(),
	);
	await sendWithResend(config, mail, {
		fetch: resend.fetch,
		wait: async (ms) => {
			waits.push(ms);
		},
	});
	expect(resend.calls).toHaveLength(3);
	expect(waits).toEqual([2000, 2000]);
	const keys = resend.calls.map(
		(c) => (c.init.headers as Record<string, string>)["Idempotency-Key"],
	);
	expect(new Set(keys).size).toBe(1);
});

test("refusals and exhausted retries become a MailError the user can read", async () => {
	vi.spyOn(console, "error").mockImplementation(() => {});
	const refused = fakeResend(err(403, "validation_error"));
	await expect(
		sendWithResend(config, mail, { fetch: refused.fetch, wait: noWait }),
	).rejects.toThrow(/kunde inte skickas just nu/);
	expect(refused.calls).toHaveLength(1);

	const quota = fakeResend(err(429, "daily_quota_exceeded"));
	await expect(
		sendWithResend(config, mail, { fetch: quota.fetch, wait: noWait }),
	).rejects.toThrow(/Gränsen/);
	expect(quota.calls).toHaveLength(1);

	const down = fakeResend(
		err(500, "application_error"),
		err(500, "application_error"),
		err(500, "application_error"),
	);
	await expect(
		sendWithResend(config, mail, { fetch: down.fetch, wait: noWait }),
	).rejects.toThrow(MailError);
	expect(down.calls).toHaveLength(3);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

test("without RESEND_API_KEY in development, mail goes to the outbox", async () => {
	vi.stubEnv("RESEND_API_KEY", "");
	const db = createClient({ url: ":memory:" });
	await migrate(db);
	vi.spyOn(console, "info").mockImplementation(() => {});
	await sendMail(db, mail);
	expect((await listOutbox(db)).map((m) => m.to)).toEqual(["anna@example.se"]);
});

test("with RESEND_API_KEY in development, DEV_MAIL_TO is required", async () => {
	vi.stubEnv("RESEND_API_KEY", "re_test");
	vi.stubEnv("MAIL_FROM", "noreply@mail.example.se");
	vi.stubEnv("DEV_MAIL_TO", "");
	const db = createClient({ url: ":memory:" });
	await expect(sendMail(db, mail)).rejects.toThrow(/DEV_MAIL_TO/);
});
