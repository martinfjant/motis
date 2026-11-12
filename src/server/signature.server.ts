import { BoardError } from "./boards.server";

// A drawn signature arrives from the browser as a PNG data URL. Only a real,
// reasonably small PNG is accepted, so what is stored can be shown as an
// image anywhere (pages, PDF) without risk.

const PREFIX = "data:image/png;base64,";
/** A drawn signature is a few kB; this leaves plenty of room. */
export const MAX_SIGNATURE_BYTES = 200_000;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The signature as stored, or throws if it isn't an acceptable PNG. */
export function cleanSignature(input: string): string {
	if (!input) throw new BoardError("Rita din signatur för att godkänna.");
	if (!input.startsWith(PREFIX))
		throw new BoardError("Signaturen kunde inte läsas. Rita den igen.");
	const base64 = input.slice(PREFIX.length);
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
		throw new BoardError("Signaturen kunde inte läsas. Rita den igen.");
	const bytes = Buffer.from(base64, "base64");
	if (bytes.length > MAX_SIGNATURE_BYTES)
		throw new BoardError("Signaturen är för stor. Rensa och rita den igen.");
	if (!bytes.subarray(0, 8).equals(PNG_MAGIC))
		throw new BoardError("Signaturen kunde inte läsas. Rita den igen.");
	return PREFIX + bytes.toString("base64");
}
