import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

// The development outbox (/utkorg). Outside development it doesn't exist.

async function ctx() {
	if (!import.meta.env.DEV) throw notFound();
	const { getDb } = await import("./db");
	const mail = await import("./mail/send.server");
	return { db: await getDb(), mail };
}

export const getOutbox = createServerFn({ method: "GET" }).handler(async () => {
	const { db, mail } = await ctx();
	return mail.listOutbox(db);
});

export const clearOutbox = createServerFn({ method: "POST" }).handler(
	async () => {
		const { db, mail } = await ctx();
		await mail.clearOutbox(db);
	},
);

/** Sends a sample email to the logged-in user, to see how emails look. */
export const sendTestMail = createServerFn({ method: "POST" }).handler(
	async () => {
		const { db, mail } = await ctx();
		const { requireUser } = await import("./session.server");
		const { user } = await requireUser();
		const { testMail } = await import("./mail/templates.server");
		await mail.sendMail(db, testMail(user));
	},
);
