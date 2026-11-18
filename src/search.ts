// Search through protocols: shared by the server (finding) and the results
// page (highlighting). Every word typed must be found, ignoring case.

/** The words of a search, lower-cased. */
export const searchWords = (query: string) =>
	query.toLocaleLowerCase("sv").split(/\s+/).filter(Boolean).slice(0, 10);

/** Whether every word is somewhere in the texts. */
export function matchesAll(texts: string[], words: string[]): boolean {
	const all = texts.join("\n").toLocaleLowerCase("sv");
	return words.length > 0 && words.every((w) => all.includes(w));
}

/**
 * A short piece of the text around the first word found in it, with "…"
 * where it was cut. The whole text if it is short.
 */
export function excerpt(text: string, words: string[], room = 160): string {
	const flat = text.replace(/\s+/g, " ").trim();
	if (flat.length <= room) return flat;
	const lower = flat.toLocaleLowerCase("sv");
	const hits = words.map((w) => lower.indexOf(w)).filter((i) => i >= 0);
	const at = hits.length > 0 ? Math.min(...hits) : 0;
	const start = Math.max(0, at - Math.floor(room / 3));
	const end = Math.min(flat.length, start + room);
	return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

/** The text split into parts, with the searched words marked. */
export function highlight(
	text: string,
	words: string[],
): { text: string; hit: boolean }[] {
	if (words.length === 0) return [{ text, hit: false }];
	const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const parts = text.split(new RegExp(`(${escaped.join("|")})`, "giu"));
	return parts
		.filter((p) => p !== "")
		.map((p) => ({
			text: p,
			hit: words.includes(p.toLocaleLowerCase("sv")),
		}));
}
