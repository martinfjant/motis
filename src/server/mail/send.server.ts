import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { appBaseUrl, type MailConfig, mailConfig } from "../config.server";

/** An email, with an HTML and a plain-text version of the same content. */
export type Mail = {
	to: string;
	subject: string;
	html: string;
	text: string;
	/** Where replies go, e.g. the board member who sent a kallelse. */
	replyTo?: string;
};

/** An email that couldn't be sent. The message is for the user. */
export class MailError extends Error {}

/**
 * Sends an email through Resend. In development without RESEND_API_KEY it
 * goes to the outbox (/utkorg) instead, so every flow can be followed
 * without sending anything.
 */
export async function sendMail(db: Client, mail: Mail): Promise<void> {
	const config = mailConfig();
	if (config) return sendWithResend(config, mail);
	await db.execute({
		sql: `INSERT INTO outbox (id, to_address, subject, text, html, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
		args: [
			randomUUID(),
			mail.to,
			mail.subject,
			mail.text,
			mail.html,
			new Date().toISOString(),
		],
	});
	console.info(`[utkorg] ${mail.subject} → ${mail.to}`);
}

const RESEND_URL = "https://api.resend.com/emails";
const ATTEMPTS = 3;

/**
 * One email through Resend's API. Rate limits and temporary errors are
 * retried a couple of times, with the same idempotency key so Resend
 * never sends it twice. Anything else is logged and becomes a MailError.
 */
export async function sendWithResend(
	config: MailConfig,
	mail: Mail,
	{ fetch = globalThis.fetch, wait = sleep } = {},
): Promise<void> {
	// In development every email goes to the developer, marked with whom
	// it was really for.
	const to = config.devTo ?? mail.to;
	const subject = config.devTo
		? `[till ${mail.to}] ${mail.subject}`
		: mail.subject;
	const body = JSON.stringify({
		from: config.from,
		to: [to],
		subject,
		html: mail.html,
		text: mail.text,
		...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
	});
	const idempotencyKey = randomUUID();

	for (let attempt = 1; ; attempt++) {
		let res: Response;
		try {
			res = await fetch(RESEND_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
					"Content-Type": "application/json",
					"User-Agent": "brf-protokoll",
					"Idempotency-Key": idempotencyKey,
				},
				body,
			});
		} catch (err) {
			// Network trouble: worth another try.
			if (attempt < ATTEMPTS) {
				await wait(1000 * attempt);
				continue;
			}
			console.error("Resend unreachable:", err);
			throw new MailError(UNAVAILABLE);
		}
		if (res.ok) return;

		const error = await res.json().catch(() => ({}));
		const name = String((error as { name?: unknown }).name ?? "");
		const retryable =
			(res.status === 429 && !name.includes("quota")) ||
			res.status === 409 ||
			res.status >= 500;
		if (retryable && attempt < ATTEMPTS) {
			const after = Number(res.headers.get("retry-after"));
			await wait(after > 0 ? Math.min(after, 10) * 1000 : 1000 * attempt);
			continue;
		}
		console.error(
			`Resend refused "${mail.subject}" to ${mail.to}: ${res.status}`,
			error,
		);
		throw new MailError(
			name.includes("quota")
				? "Gränsen för hur många mejl som får skickas är nådd. Försök igen i morgon."
				: UNAVAILABLE,
		);
	}
}

const UNAVAILABLE =
	"Mejlet kunde inte skickas just nu. Försök igen om en stund.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A full address into the app, for links in emails, e.g.
 * appUrl("/dagordning/abc"). APP_URL is the site's address in production.
 */
export function appUrl(path: string): string {
	return new URL(path, appBaseUrl()).href;
}

export type OutboxMail = Mail & { id: string; createdAt: string };

/** The outbox, newest first. */
export async function listOutbox(db: Client): Promise<OutboxMail[]> {
	const res = await db.execute(
		"SELECT * FROM outbox ORDER BY created_at DESC LIMIT 100",
	);
	return res.rows.map((r) => ({
		id: String(r.id),
		to: String(r.to_address),
		subject: String(r.subject),
		text: String(r.text),
		html: String(r.html),
		createdAt: String(r.created_at),
	}));
}

export async function clearOutbox(db: Client): Promise<void> {
	await db.execute("DELETE FROM outbox");
}
