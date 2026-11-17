import { readSignature, writeSignature } from "../signature";
import { BoardError } from "./boards.server";

// A drawn signature arrives from the browser as SVG (signature_pad's
// toSVG). It is read strictly and stored as the clean SVG writeSignature
// makes, never as sent, so what is stored can be shown anywhere (pages,
// PDF) without risk. Older approvals may hold a PNG data URL instead.

/** The signature as stored, or throws if it isn't a readable drawing. */
export function cleanSignature(input: string): string {
	if (!input) throw new BoardError("Rita din signatur för att godkänna.");
	const shape = readSignature(input);
	if (!shape)
		throw new BoardError(
			"Signaturen kunde inte läsas. Rensa och rita den igen.",
		);
	return writeSignature(shape);
}
