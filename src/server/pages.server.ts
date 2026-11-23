import { Marked } from "marked";

/**
 * Static pages written in Markdown: help for users and statements such as
 * the privacy policy. Each file in content/sidor/ is one page, its address
 * the file's path without ".md" (content/sidor/hjalp/moten.md is
 * /hjalp/moten); an index.md is its folder's address (hjalp/index.md is
 * /hjalp). The files are bundled into the server build, like the
 * migrations, and turned into HTML here, so browsers never load the
 * Markdown or the code that reads it.
 *
 * A file starts with a header between two "---" lines:
 *
 *   ---
 *   title: Integritetspolicy          (required; the page's heading)
 *   description: En mening om sidan.  (for search engines and link previews)
 *   updated: 2026-11-23               ("Senast uppdaterad", YYYY-MM-DD)
 *   footer: 2                         (listed in the footer, in this order)
 *   ---
 *
 * The title is the page's only h1, so the text itself starts at "##".
 * Pages are written by us, not by users, so their HTML is used as it is.
 */

const files = import.meta.glob("../../content/sidor/**/*.md", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

export type Page = {
	/** The address without the leading slash: "integritet", "hjalp/moten". */
	path: string;
	title: string;
	description: string;
	/** YYYY-MM-DD, or "" when not given. */
	updated: string;
	/** Position in the footer, or null when not listed there. */
	footer: number | null;
	html: string;
};

export type FooterLink = Pick<Page, "path" | "title">;

/** "content/sidor/hjalp/index.md" → "hjalp". */
export function pathOf(file: string): string {
	return file
		.replace(/^.*?content\/sidor\//, "")
		.replace(/\.md$/, "")
		.replace(/(^|\/)index$/, "");
}

/** A heading's id, for links to it: "Vilka uppgifter vi sparar" → "vilka-uppgifter-vi-sparar". */
export function headingId(html: string): string {
	return html
		.replace(/<[^>]*>/g, "")
		.replace(/&[a-z#0-9]+;/gi, "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function markdown() {
	const used = new Map<string, number>();
	return new Marked({
		gfm: true,
		renderer: {
			heading({ tokens, depth }) {
				if (depth === 1)
					throw new Error(
						"en rubrik på nivå 1 (#): sidans titel kommer från huvudet, så texten börjar på ##.",
					);
				const html = this.parser.parseInline(tokens);
				const base = headingId(html) || "rubrik";
				const n = used.get(base) ?? 0;
				used.set(base, n + 1);
				const id = n === 0 ? base : `${base}-${n + 1}`;
				return `<h${depth} id="${id}">${html}</h${depth}>\n`;
			},
		},
	});
}

/** Reads one file. Throws on a missing title or a malformed header. */
export function parsePage(file: string, source: string): Page {
	const fail = (why: string) => new Error(`${file}: ${why}`);
	const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(source);
	if (!match) throw fail('huvudet mellan två "---"-rader saknas.');
	const [, head, body] = match;
	const fields = new Map<string, string>();
	for (const line of head.split(/\r?\n/)) {
		if (!line.trim()) continue;
		const at = line.indexOf(":");
		if (at < 1) throw fail(`raden "${line}" i huvudet saknar ":".`);
		fields.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
	}
	const title = fields.get("title") ?? "";
	if (!title) throw fail('"title" saknas i huvudet.');
	const updated = fields.get("updated") ?? "";
	if (updated && !/^\d{4}-\d{2}-\d{2}$/.test(updated))
		throw fail('"updated" ska skrivas ÅÅÅÅ-MM-DD.');
	const footerField = fields.get("footer") ?? "";
	const footer = footerField === "" ? null : Number(footerField);
	if (footer !== null && !Number.isFinite(footer))
		throw fail('"footer" ska vara ett tal.');
	let html: string;
	try {
		html = markdown().parse(body, { async: false });
	} catch (err) {
		throw fail(err instanceof Error ? err.message : String(err));
	}
	return {
		path: pathOf(file),
		title,
		description: fields.get("description") ?? "",
		updated,
		footer,
		html,
	};
}

/** Reads every file into pages by path; throws if two share an address. */
export function readPages(sources: Record<string, string>): Map<string, Page> {
	const pages = new Map<string, Page>();
	for (const [file, source] of Object.entries(sources)) {
		const page = parsePage(file, source);
		if (pages.has(page.path))
			throw new Error(`Två sidor har adressen /${page.path}.`);
		pages.set(page.path, page);
	}
	return pages;
}

let cache: Map<string, Page> | undefined;

/** Every page in content/sidor/, by path. Read once. */
export function allPages(): Map<string, Page> {
	cache ??= readPages(files);
	return cache;
}

export function findPage(path: string): Page | null {
	return allPages().get(path.replace(/^\/+|\/+$/g, "")) ?? null;
}

/** The pages with "footer" in their header, in its order. */
export function footerLinks(): FooterLink[] {
	return [...allPages().values()]
		.filter((p) => p.footer !== null)
		.sort((a, b) => (a.footer ?? 0) - (b.footer ?? 0))
		.map(({ path, title }) => ({ path, title }));
}
