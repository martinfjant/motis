import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scrypt(password, salt, 64, (err, key) =>
			err ? reject(err) : resolve(key),
		),
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await derive(password, salt);
	return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [scheme, saltB64, keyB64] = stored.split("$");
	if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
	const expected = Buffer.from(keyB64, "base64");
	const actual = await derive(password, Buffer.from(saltB64, "base64"));
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}
