// Every setting the server reads from the environment, in one place. See
// .env.example for what each one is. In development everything has a
// default; in production the required ones must be set, and the server
// fails with a clear message (and /api/health reports it) instead of
// half-working.

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

/**
 * Whether to trust X-Forwarded-For for the client's IP address (login rate
 * limiting). Only when a proxy in front of the app always sets it, or
 * clients could pretend to be anyone.
 */
export const trustProxy = env.TRUST_PROXY === "1";

/** Session cookies only over https in production. */
export const secureCookies = isProduction;

/** Every problem with the settings, for the health check. Empty when fine. */
export function configProblems(): string[] {
	const problems: string[] = [];
	for (const check of [databaseConfig, appBaseUrl])
		try {
			check();
		} catch (err) {
			if (err instanceof ConfigError) problems.push(err.message);
			else throw err;
		}
	return problems;
}
