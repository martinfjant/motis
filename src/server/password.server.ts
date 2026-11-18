import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Passwords are stored as scrypt hashes, a memory-hard function built into
// Node (argon2 is only built in from Node 24.7). Stored as
// "scrypt$N$r$p$salt$key", so the cost can be raised later: a hash made
// with other settings still works, and is remade at the next login (see
// needsRehash).

type Cost = { N: number; r: number; p: number };

/**
 * OWASP's recommended scrypt settings for 32 MiB of memory per hash
 * (https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
 */
export const COST: Cost = { N: 2 ** 15, r: 8, p: 3 };

/** What hashes from before the cost was stored ("scrypt$salt$key") used. */
const LEGACY: Cost = { N: 2 ** 14, r: 8, p: 1 };

function derive(password: string, salt: Buffer, cost: Cost): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scrypt(
			password,
			salt,
			64,
			// Needs 128 × N × r bytes; Node's default limit is just too small.
			{ ...cost, maxmem: 256 * cost.N * cost.r },
			(err, key) => (err ? reject(err) : resolve(key)),
		),
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await derive(password, salt, COST);
	const { N, r, p } = COST;
	return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** The parts of a stored hash, or null if it isn't one. */
function parse(stored: string) {
	const parts = stored.split("$");
	if (parts[0] !== "scrypt") return null;
	if (parts.length === 3)
		return { cost: LEGACY, salt: parts[1], key: parts[2] };
	if (parts.length !== 6) return null;
	const [N, r, p] = parts.slice(1, 4).map(Number);
	// Only sane settings: a stored hash can't make the server use any amount
	// of memory.
	if (![N, r, p].every(Number.isInteger) || N > 2 ** 17 || r > 16 || p > 16)
		return null;
	return { cost: { N, r, p }, salt: parts[4], key: parts[5] };
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const hash = parse(stored);
	if (!hash || !hash.salt || !hash.key) return false;
	const expected = Buffer.from(hash.key, "base64");
	const actual = await derive(
		password,
		Buffer.from(hash.salt, "base64"),
		hash.cost,
	);
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Whether a stored hash was made with other settings than COST. */
export function needsRehash(stored: string): boolean {
	const hash = parse(stored);
	return (
		!hash ||
		hash.cost.N !== COST.N ||
		hash.cost.r !== COST.r ||
		hash.cost.p !== COST.p
	);
}

/**
 * Something to verify against when there is no account, taking as long as a
 * real check, so the time taken doesn't reveal whether an email exists.
 */
export const NO_ACCOUNT_HASH = `scrypt$${COST.N}$${COST.r}$${COST.p}$AAAAAAAAAAAAAAAAAAAAAA==$AAAA`;
