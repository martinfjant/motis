import type { Client } from "@libsql/client";
import { createServerFn } from "@tanstack/react-start";
import {
	deleteCookie,
	getCookie,
	getRequestIP,
	setCookie,
} from "@tanstack/react-start/server";
import type { User } from "./auth.server";

const COOKIE = "session";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (d: unknown) => (d ?? {}) as Record<string, unknown>;

async function startSession(userId: string) {
	const { createSession } = await import("./auth.server");
	const { getDb } = await import("./db");
	const { token, expires } = await createSession(await getDb(), userId);
	setCookie(COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		expires,
	});
}

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
	async () => {
		const { getSessionUser } = await import("./auth.server");
		const { getDb } = await import("./db");
		return getSessionUser(await getDb(), getCookie(COOKIE));
	},
);

export const signUp = createServerFn({ method: "POST" })
	.validator((d: unknown) => {
		const o = (d ?? {}) as Record<string, unknown>;
		return {
			name: str(o.name),
			email: str(o.email),
			password: str(o.password),
		};
	})
	.handler(async ({ data }) => {
		const { createUser } = await import("./auth.server");
		const { getDb } = await import("./db");
		const db = await getDb();
		const user = await createUser(db, data);
		await startSession(user.id);
		await sendVerificationSafely(db, user);
		return user;
	});

export const logIn = createServerFn({ method: "POST" })
	.validator((d: unknown) => {
		const o = (d ?? {}) as Record<string, unknown>;
		return { email: str(o.email), password: str(o.password) };
	})
	.handler(async ({ data }) => {
		const { logInWithLimit } = await import("./login-limit.server");
		const { getDb } = await import("./db");
		// Behind a proxy (e.g. in production) the client's address is only in
		// X-Forwarded-For. Trust that header only when told to, since clients
		// can set it themselves when nothing in front of the app overwrites it.
		const ip = getRequestIP({ xForwardedFor: process.env.TRUST_PROXY === "1" });
		const user = await logInWithLimit(await getDb(), { ...data, ip });
		await startSession(user.id);
		return user;
	});

export const logOut = createServerFn({ method: "POST" }).handler(async () => {
	const { deleteSession } = await import("./auth.server");
	const { getDb } = await import("./db");
	await deleteSession(await getDb(), getCookie(COOKIE));
	deleteCookie(COOKIE, { path: "/" });
});

export const updateProfile = createServerFn({ method: "POST" })
	.validator((d: unknown) => {
		const o = (d ?? {}) as Record<string, unknown>;
		return {
			name: str(o.name),
			email: str(o.email),
			currentPassword: str(o.currentPassword),
		};
	})
	.handler(async ({ data }) => {
		const { requireUser } = await import("./session.server");
		const { updateProfile } = await import("./auth.server");
		const { db, user } = await requireUser();
		const updated = await updateProfile(db, user.id, data);
		await sendVerificationSafely(db, updated);
		return updated;
	});

/**
 * Sends the confirmation link, if the address is unconfirmed. A failed
 * email must not undo signing up or saving, so failures are only logged;
 * the user can ask for the link again.
 */
async function sendVerificationSafely(db: Client, user: User) {
	const { sendVerification } = await import("./account.server");
	try {
		await sendVerification(db, user);
	} catch (err) {
		console.error("Kunde inte skicka bekräftelsemejl:", err);
	}
}

/** "Skicka mejlet igen": a new confirmation link to the logged-in user. */
export const resendVerification = createServerFn({ method: "POST" }).handler(
	async () => {
		const { requireUser } = await import("./session.server");
		const { sendVerification } = await import("./account.server");
		const { db, user } = await requireUser();
		await sendVerification(db, user);
	},
);

/** Follows a confirmation link (from the email, so a GET). */
export const verifyEmail = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ token: str(obj(d).token) }))
	.handler(async ({ data }) => {
		const { verifyEmail } = await import("./account.server");
		const { getDb } = await import("./db");
		return verifyEmail(await getDb(), data.token);
	});

export const requestPasswordReset = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ email: str(obj(d).email) }))
	.handler(async ({ data }) => {
		const { requestPasswordReset } = await import("./account.server");
		const { getDb } = await import("./db");
		await requestPasswordReset(await getDb(), data.email);
	});

export const checkPasswordReset = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ token: str(obj(d).token) }))
	.handler(async ({ data }) => {
		const { checkPasswordReset } = await import("./account.server");
		const { getDb } = await import("./db");
		return checkPasswordReset(await getDb(), data.token);
	});

/** Sets the new password and logs in (every other session is ended). */
export const resetPassword = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		token: str(obj(d).token),
		password: str(obj(d).password),
	}))
	.handler(async ({ data }) => {
		const { resetPassword } = await import("./account.server");
		const { getDb } = await import("./db");
		const userId = await resetPassword(
			await getDb(),
			data.token,
			data.password,
		);
		await startSession(userId);
	});
