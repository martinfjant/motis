// References to other protocols in notes and decisions, written as
// "#Styrelsemöte 12-11-2026" (title and meeting date): readable as plain
// text everywhere (PDF, Markdown, public pages) and turned into links on the
// members' protocol page. Typing # offers them (see MentionTextarea).

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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The text split into plain parts and references to known protocols. A
 * reference to a protocol that isn't known (renamed, deleted, another
 * board) stays plain text.
 */
export function splitRefs(
	text: string,
	refs: ProtocolRef[],
): (string | ProtocolRef)[] {
	if (refs.length === 0 || !text.includes("#")) return [text];
	const byText = new Map(refs.map((r) => [refText(r), r]));
	// Longest first, so "#Möte 1-1" doesn't win over "#Möte 1-1 extra".
	const pattern = new RegExp(
		[...byText.keys()]
			.sort((a, b) => b.length - a.length)
			.map(escapeRegExp)
			.join("|"),
		"g",
	);
	const parts: (string | ProtocolRef)[] = [];
	let last = 0;
	for (const m of text.matchAll(pattern)) {
		const ref = byText.get(m[0]);
		if (!ref || m.index === undefined) continue;
		if (m.index > last) parts.push(text.slice(last, m.index));
		parts.push(ref);
		last = m.index + m[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return parts;
}
