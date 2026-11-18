import type { Client } from "@libsql/client";
import { formatMeetingAt } from "../meeting-time";
import { excerpt, matchesAll, searchWords } from "../search";

/** A protocol with the points where the search was found. */
export type SearchResult = {
	boardId: string;
	boardName: string;
	protocolId: string;
	title: string;
	/** DD-MM-YYYY, or "" without a meeting date. */
	date: string;
	hits: { itemId: string; itemTitle: string; excerpt: string }[];
};

const MAX_RESULTS = 50;

/**
 * Protocols of the user's boards where every word is found: in the
 * protocol's title, or in one point (its title, notes or decision).
 * Newest first. Matching is done here rather than in SQL, which only
 * ignores case for A–Z (not Å, Ä, Ö); a board's protocols are few.
 */
export async function searchProtocols(
	db: Client,
	userId: string,
	query: string,
): Promise<SearchResult[]> {
	const words = searchWords(query);
	if (words.length === 0) return [];
	const res = await db.execute({
		sql: `SELECT p.id, p.title, p.meeting_at, b.id AS board_id, b.name AS board_name,
                 i.id AS item_id, i.title AS item_title, i.value
          FROM protocols p
          JOIN boards b ON b.id = p.board_id
          JOIN board_memberships m ON m.board_id = b.id AND m.user_id = ?
          LEFT JOIN protocol_items i ON i.protocol_id = p.id
          ORDER BY p.meeting_at DESC, p.created_at DESC, i.position`,
		args: [userId],
	});

	const results = new Map<string, SearchResult>();
	const titleHit = new Set<string>();
	for (const r of res.rows) {
		const id = String(r.id);
		let result = results.get(id);
		if (!result) {
			result = {
				boardId: String(r.board_id),
				boardName: String(r.board_name),
				protocolId: id,
				title: String(r.title),
				date: r.meeting_at
					? formatMeetingAt(String(r.meeting_at)).slice(0, 10)
					: "",
				hits: [],
			};
			results.set(id, result);
			if (matchesAll([result.title], words)) titleHit.add(id);
		}
		if (!r.item_id) continue;
		const value = parse(r.value);
		const itemTitle = String(r.item_title);
		const texts = [value.decision, value.notes].filter(
			(t): t is string => typeof t === "string" && t.trim() !== "",
		);
		if (!matchesAll([itemTitle, ...texts], words)) continue;
		const text =
			texts.find((t) => matchesAll([t], words.slice(0, 1))) ?? texts[0] ?? "";
		result.hits.push({
			itemId: String(r.item_id),
			itemTitle,
			excerpt: text ? excerpt(text, words) : "",
		});
	}
	return [...results.values()]
		.filter((r) => r.hits.length > 0 || titleHit.has(r.protocolId))
		.slice(0, MAX_RESULTS);
}

function parse(raw: unknown): { notes?: unknown; decision?: unknown } {
	try {
		const v = JSON.parse(String(raw));
		return v && typeof v === "object" ? v : {};
	} catch {
		return {};
	}
}
