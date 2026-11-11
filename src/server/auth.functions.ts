import { createServerFn } from "@tanstack/react-start";
import {
	deleteCookie,
	getCookie,
	getRequestIP,
	setCookie,
} from "@tanstack/react-start/server";

const COOKIE = "session";

const str = (v: unknown) => (typeof v === "string" ? v : "");

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
		const user = await createUser(await getDb(), data);
		await startSession(user.id);
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
		return updateProfile(db, user.id, data);
	});
