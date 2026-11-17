// Drawn signatures as SVG: read strictly, written cleanly. Shared by the
// server (which only stores what writeSignature produces) and the pages
// (which draw the shapes themselves, so the ink can follow dark mode).
//
// signature_pad's toSVG() gives an <svg> with three kinds of shape, all in
// the pen colour: <path d="M x,y C …"> per curve piece (with a stroke
// width), <circle> per dot and <line> for very short strokes. Nothing else
// is accepted (besides the <g> writeSignature wraps them in): no scripts,
// links, images, styles or entities, and only plain numbers.

/** The ink in stored signatures (stone-900), for PDFs and other viewers. */
export const INK = "#1c1917";

/** A signature's shapes, in a viewBox of 0 0 width height. */
export type SignatureShape = {
	width: number;
	height: number;
	parts: SignaturePart[];
};

export type SignaturePart =
	| { kind: "path"; d: string; strokeWidth: number }
	| { kind: "circle"; cx: number; cy: number; r: number }
	| {
			kind: "line";
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			strokeWidth: number;
	  };

/** A stored signature is a few hundred shapes; this leaves plenty of room. */
export const MAX_SIGNATURE_LENGTH = 400_000;
const MAX_PARTS = 20_000;
const MAX_SIZE = 4000;

const NUM = String.raw`-?\d+(?:\.\d+)?(?:e[-+]?\d+)?`;
/** One curve piece, exactly as signature_pad writes it. */
const CURVE = new RegExp(
	`^M ${NUM},${NUM} C ${NUM},${NUM} ${NUM},${NUM} ${NUM},${NUM}$`,
);

function num(value: string | undefined, max = MAX_SIZE): number | null {
	if (value === undefined || !new RegExp(`^${NUM}$`).test(value)) return null;
	const n = Number(value);
	return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

/**
 * Reads an SVG signature, or returns null if it holds anything but the
 * shapes above with plain numbers.
 */
export function readSignature(svg: string): SignatureShape | null {
	if (!svg || svg.length > MAX_SIGNATURE_LENGTH) return null;
	// No comments, doctypes, CDATA, processing instructions or entities.
	if (/<!|<\?|&/.test(svg)) return null;
	const tags = [...svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^<>]*?)(\/?)>/g)];
	// Everything must be tags (with only whitespace between them).
	if (svg.replace(/<[^<>]*>/g, "").trim() !== "") return null;
	const [root, ...rest] = tags;
	if (!root || root[1] || root[2] !== "svg") return null;
	const rootAttrs = attrs(root[3]);
	if (JUNK in rootAttrs || !onlyAllowed("svg", rootAttrs)) return null;
	const box = /^0 0 (\S+) (\S+)$/.exec(rootAttrs.viewBox ?? "");
	const width = num(box?.[1]);
	const height = num(box?.[2]);
	if (!width || !height || width <= 0 || height <= 0) return null;

	const parts: SignaturePart[] = [];
	for (const [, closing, tag, raw] of rest) {
		if (closing) {
			if (SHAPES.has(tag) || tag === "svg" || tag === "g") continue;
			return null;
		}
		const a = attrs(raw);
		if (JUNK in a || !onlyAllowed(tag, a)) return null;
		// The group writeSignature puts the shapes in; its colours are ours.
		if (tag === "g") continue;
		if (tag === "path") {
			const strokeWidth = num(a["stroke-width"], 100);
			if (!a.d || !CURVE.test(a.d) || strokeWidth === null) return null;
			parts.push({ kind: "path", d: a.d, strokeWidth });
		} else if (tag === "circle") {
			const [cx, cy, r] = [num(a.cx), num(a.cy), num(a.r, 100)];
			if (cx === null || cy === null || r === null) return null;
			parts.push({ kind: "circle", cx, cy, r });
		} else if (tag === "line") {
			const [x1, y1, x2, y2] = [num(a.x1), num(a.y1), num(a.x2), num(a.y2)];
			const strokeWidth = num(a["stroke-width"], 100);
			if ([x1, y1, x2, y2, strokeWidth].some((n) => n === null)) return null;
			parts.push({
				kind: "line",
				x1: x1 as number,
				y1: y1 as number,
				x2: x2 as number,
				y2: y2 as number,
				strokeWidth: strokeWidth as number,
			});
		} else return null;
		if (parts.length > MAX_PARTS) return null;
	}
	return parts.length > 0 ? { width, height, parts } : null;
}

const SHAPES = new Set(["path", "circle", "line"]);

/**
 * The attributes signature_pad writes (and writeSignature), per element.
 * Any other attribute makes the signature unreadable. Colours are not
 * checked: they are never kept, the stored copy uses INK.
 */
const ALLOWED: Record<string, Set<string>> = {
	svg: new Set(["xmlns", "xmlns:xlink", "viewBox", "width", "height"]),
	g: new Set(["fill", "stroke", "stroke-linecap"]),
	path: new Set(["d", "stroke-width", "stroke", "fill", "stroke-linecap"]),
	circle: new Set(["cx", "cy", "r", "fill", "stroke"]),
	line: new Set([
		"x1",
		"y1",
		"x2",
		"y2",
		"stroke",
		"stroke-width",
		"stroke-linecap",
		"fill",
	]),
};
const onlyAllowed = (tag: string, a: Record<string, string>) =>
	Object.keys(a).every((name) => ALLOWED[tag]?.has(name));
/** Marks a tag with anything but name="value" pairs in it. */
const JUNK = "\u0000";

/** Name="value" pairs of a tag; anything else in it makes it unreadable. */
function attrs(raw: string): Record<string, string> {
	const out: Record<string, string> = {};
	const rest = raw.replace(
		/\s*([a-zA-Z][\w:-]*)="([^"<>]*)"/g,
		(_, name: string, value: string) => {
			out[name] = value;
			return "";
		},
	);
	// Leftovers (unquoted values, stray characters) other than a final "/".
	if (rest.replace("/", "").trim() !== "") out[JUNK] = rest;
	return out;
}

/** The clean SVG stored for a signature, in the given ink. */
export function writeSignature(shape: SignatureShape, ink = INK): string {
	const parts = shape.parts.map((p) =>
		p.kind === "path"
			? `<path d="${p.d}" stroke-width="${p.strokeWidth}"/>`
			: p.kind === "circle"
				? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${ink}" stroke="none"/>`
				: `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke-width="${p.strokeWidth}"/>`,
	);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.width} ${shape.height}" width="${shape.width}" height="${shape.height}"><g fill="none" stroke="${ink}" stroke-linecap="round">${parts.join("")}</g></svg>`;
}

/** Whether a stored signature is SVG (newer) rather than a PNG data URL. */
export const isSvgSignature = (stored: string) => stored.startsWith("<svg");
