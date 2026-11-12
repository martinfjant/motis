import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";

/** An email, with an HTML and a plain-text version of the same content. */
export type Mail = { to: string; subject: string; html: string; text: string };

export class MailError extends Error {}

/**
 * Sends an email. In development it goes to the outbox (/utkorg) instead,
 * so every flow can be followed without sending anything. The provider
 * (Resend) is not connected yet, so outside development this refuses.
 */
export async function sendMail(db: Client, mail: Mail): Promise<void> {
	if (!import.meta.env.DEV)
		throw new MailError("E-post kan inte skickas ännu.");
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

/**
 * A full address into the app, for links in emails, e.g.
 * appUrl("/dagordning/abc"). APP_URL is the site's address in production.
 */
export function appUrl(path: string): string {
	return new URL(path, process.env.APP_URL ?? "http://localhost:3000").href;
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
