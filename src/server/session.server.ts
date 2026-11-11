import { getCookie } from "@tanstack/react-start/server";
import { getSessionUser } from "./auth.server";
import { getDb } from "./db";

export const SESSION_COOKIE = "session";

/** Resolves the logged-in user from the cookie, or throws. */
export async function requireUser() {
	const db = await getDb();
	const user = await getSessionUser(db, getCookie(SESSION_COOKIE));
	if (!user) throw new Error("Du måste logga in.");
	return { db, user };
}
