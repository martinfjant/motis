// Every setting the server reads from the environment, in one place. See
// .env.example for what each one is. In development everything has a
// default; in production the required ones must be set, and the server
// fails with a clear message (and /api/health reports it) instead of
// half-working.

import { existsSync } from "node:fs";

// Development: settings can be kept in a .env file in the project folder
// (ignored by git and Docker), e.g. a Resend key for trying real email.
// Settings already in the environment win. Production gets everything from
// the environment, and tests never read the file, so they can't send mail.
if (
	process.env.NODE_ENV !== "production" &&
	!process.env.VITEST &&
	existsSync(".env")
)
	process.loadEnvFile(".env");

const env = process.env;

/** Running the production build (the Docker image sets NODE_ENV). */
export const isProduction = env.NODE_ENV === "production";

export class ConfigError extends Error {}

function required(names: string[], devDefault: string): string {
	for (const name of names) {
		const value = env[name]?.trim();
		if (value) return value;
	}
	if (!isProduction) return devDefault;
	throw new ConfigError(`Inställningen ${names.join(" eller ")} saknas.`);
}

/**
 * The database. Bunny injects BUNNY_DATABASE_URL and
 * BUNNY_DATABASE_AUTH_TOKEN when a database is linked to the app;
 * DATABASE_URL and DATABASE_AUTH_TOKEN work too, e.g. for another host.
 */
export function databaseConfig() {
	return {
		url: required(["BUNNY_DATABASE_URL", "DATABASE_URL"], "file:local.db"),
		authToken:
			env.BUNNY_DATABASE_AUTH_TOKEN?.trim() ||
			env.DATABASE_AUTH_TOKEN?.trim() ||
			undefined,
	};
}

/** The site's public address, for links in emails. https in production. */
export function appBaseUrl(): string {
	const url = required(["APP_URL"], "http://localhost:3000");
	if (isProduction && !url.startsWith("https://"))
		throw new ConfigError("APP_URL måste börja med https://.");
	return url;
}

/** Sending email through Resend. */
export type MailConfig = {
	apiKey: string;
	/** The sender, e.g. "Mötis <noreply@mail.example.se>". */
	from: string;
	/**
	 * Development only: every email goes to this address instead, so test
	 * data's addresses never get real mail.
	 */
	devTo?: string;
};

/**
 * Email through Resend, or null for the development outbox. Production
 * requires RESEND_API_KEY and MAIL_FROM. In development the outbox is used
 * unless RESEND_API_KEY is set, and then DEV_MAIL_TO must be too.
 */
export function mailConfig(): MailConfig | null {
	const apiKey = env.RESEND_API_KEY?.trim();
	if (!apiKey) {
		if (isProduction)
			throw new ConfigError("Inställningen RESEND_API_KEY saknas.");
		return null;
	}
	const from = env.MAIL_FROM?.trim();
	if (!from) throw new ConfigError("Inställningen MAIL_FROM saknas.");
	if (isProduction) return { apiKey, from };
	const devTo = env.DEV_MAIL_TO?.trim();
	if (!devTo)
		throw new ConfigError(
			"Sätt DEV_MAIL_TO till din egen adress när RESEND_API_KEY används under utveckling.",
		);
	return { apiKey, from, devTo };
}

/**
 * The request header holding the visitor's IP address (for limiting login
 * attempts per address), set by the proxy in front of the app. Only a
 * header the proxy always sets itself, overwriting whatever the visitor
 * sent: anything else can be faked. On Bunny, an edge rule sets it (see
 * .env.example). Without it the address the app sees is used: right without
 * a proxy, but behind one that is the proxy's, so the address limit is then
 * left out rather than shared by everyone.
 */
export const clientIpHeader =
	env.CLIENT_IP_HEADER?.trim().toLowerCase() || null;

/**
 * Who may create an account while the service isn't open to everyone:
 * - "open": anyone (development without SIGNUP_PASSWORD)
 * - "password": only with SIGNUP_PASSWORD
 * - "closed": no one (production without SIGNUP_PASSWORD, so forgetting
 *   the setting can't leave sign-up open)
 */
export type SignupPolicy =
	| { kind: "open" }
	| { kind: "password"; password: string }
	| { kind: "closed" };

export function signupPolicy(): SignupPolicy {
	const password = env.SIGNUP_PASSWORD?.trim();
	if (password) return { kind: "password", password };
	return isProduction ? { kind: "closed" } : { kind: "open" };
}

/**
 * Where uploaded files (logos, banners, attachments) are kept: a Bunny
 * storage zone in production, a local folder in development and tests.
 */
export type FileStorageConfig =
	| { kind: "bunny"; zone: string; accessKey: string; region: string }
	| { kind: "folder"; dir: string };

/**
 * Production requires a storage zone. Linking the zone to the app in Bunny
 * sets STORAGE_ZONE, STORAGE_ACCESS_KEY and STORAGE_HOSTNAME (e.g.
 * se.storage.bunnycdn.com, whose first part is the region); the
 * BUNNY_STORAGE_ names work too. Development uses FILES_DIR (default
 * local-files/) unless a zone is set.
 */
export function fileStorageConfig(): FileStorageConfig {
	const setting = (...names: string[]) =>
		names.map((n) => env[n]?.trim()).find(Boolean);
	const zone = setting("BUNNY_STORAGE_ZONE", "STORAGE_ZONE");
	const accessKey = setting("BUNNY_STORAGE_KEY", "STORAGE_ACCESS_KEY");
	if (zone && accessKey)
		return {
			kind: "bunny",
			zone,
			accessKey,
			region:
				setting("BUNNY_STORAGE_REGION") ??
				regionOf(setting("STORAGE_HOSTNAME")) ??
				"se",
		};
	if (isProduction)
		throw new ConfigError(
			zone
				? "Inställningen STORAGE_ACCESS_KEY (eller BUNNY_STORAGE_KEY) saknas."
				: "Inställningen STORAGE_ZONE (eller BUNNY_STORAGE_ZONE) saknas.",
		);
	return { kind: "folder", dir: env.FILES_DIR?.trim() || "local-files" };
}

/**
 * The region in a storage hostname, as Bunny's SDK names it:
 * "se.storage.bunnycdn.com" is "se"; the main region, Falkenstein, has none
 * ("storage.bunnycdn.com") and is "de".
 */
export function regionOf(hostname: string | undefined): string | undefined {
	if (!hostname) return undefined;
	const host = hostname.replace(/^https?:\/\//, "").split("/")[0];
	if (host === "storage.bunnycdn.com") return "de";
	return /^([a-z]+)\.storage\.bunnycdn\.com$/.exec(host)?.[1];
}

/** Session cookies only over https in production. */
export const secureCookies = isProduction;

/** Every problem with the settings, for the health check. Empty when fine. */
export function configProblems(): string[] {
	const problems: string[] = [];
	for (const check of [
		databaseConfig,
		appBaseUrl,
		mailConfig,
		fileStorageConfig,
	])
		try {
			check();
		} catch (err) {
			if (err instanceof ConfigError) problems.push(err.message);
			else throw err;
		}
	return problems;
}
