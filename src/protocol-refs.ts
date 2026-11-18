// References to other protocols in notes and decisions, written as
// "#Styrelsemöte 12-11-2026" (title and meeting date): readable as plain
// text everywhere (PDF, Markdown, public pages) and turned into links on the
// members' protocol page. Typing # offers them (see MentionTextarea).
//
// When a point is saved, the server records which protocol each reference
// meant (the value's `links`, see findLinks). The text keeps the name the
// meeting had when it was written; the link keeps working if the protocol
// is later renamed or moved to another date.

/** Another protocol of the board that can be referred to. */
export type ProtocolRef = {
	id: string;
	title: string;
	/** The meeting's date, DD-MM-YYYY. */
	date: string;
};

/** How a reference is written in the text. */
export const refText = (ref: ProtocolRef) => `#${ref.title} ${ref.date}`;

const MONTHS = [
	"januari",
	"februari",
	"mars",
	"april",
	"maj",
	"juni",
	"juli",
	"augusti",
	"september",
	"oktober",
	"november",
	"december",
];

/** What a protocol is found by: its title, date, and month in Swedish. */
function searchText(ref: ProtocolRef) {
	const month = MONTHS[Number(ref.date.slice(3, 5)) - 1] ?? "";
	return `${ref.title} ${ref.date} ${month}`.toLocaleLowerCase("sv");
}

/**
 * Protocols matching every word of the query, ignoring case: part of the
 * title, the date or the month's name ("#nov", "#styrelse nov 2026").
 */
export function matchRefs(refs: ProtocolRef[], query: string): ProtocolRef[] {
	const words = query.toLocaleLowerCase("sv").split(/\s+/).filter(Boolean);
	return refs.filter((r) => {
		const text = searchText(r);
		return words.every((w) => text.includes(w));
	});
}

/** A reference as written, and the protocol it means. */
export type RefLink = { text: string; id: string };

/** The links for protocols as they are named now. */
export const linksFor = (refs: ProtocolRef[]): RefLink[] =>
	refs.map((r) => ({ text: refText(r), id: r.id }));

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The text split into plain parts and the references in it. A reference
 * not among the links (an unknown or deleted protocol) stays plain text.
 */
export function splitRefs(
	text: string,
	links: RefLink[],
): (string | RefLink)[] {
	if (links.length === 0 || !text.includes("#")) return [text];
	const byText = new Map(links.map((l) => [l.text, l]));
	// Longest first, so "#Möte 1-1" doesn't win over "#Möte 1-1 extra".
	const pattern = new RegExp(
		[...byText.keys()]
			.sort((a, b) => b.length - a.length)
			.map(escapeRegExp)
			.join("|"),
		"g",
	);
	const parts: (string | RefLink)[] = [];
	let last = 0;
	for (const m of text.matchAll(pattern)) {
		const link = byText.get(m[0]);
		if (!link || m.index === undefined) continue;
		if (m.index > last) parts.push(text.slice(last, m.index));
		parts.push(link);
		last = m.index + m[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return parts;
}

/**
 * The references in the texts, as { text: protocol id }: to the board's
 * protocols as named now, or as recorded before (`kept`, so a reference to
 * a since renamed protocol keeps its link when the text is saved again).
 */
export function findLinks(
	texts: string[],
	refs: ProtocolRef[],
	kept: Record<string, string> = {},
): Record<string, string> {
	const known = [
		...Object.entries(kept).map(([text, id]) => ({ text, id })),
		...linksFor(refs),
	];
	const found: Record<string, string> = {};
	for (const text of texts)
		for (const part of splitRefs(text, known))
			if (typeof part !== "string") found[part.text] = part.id;
	return found;
}
