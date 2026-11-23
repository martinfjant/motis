import { expect, test } from "vitest";
import {
	allPages,
	findPage,
	footerLinks,
	headingId,
	parsePage,
	pathOf,
	readPages,
} from "./pages.server";

const page = (body: string, head = "title: Sida") =>
	`---\n${head}\n---\n${body}`;

test("a file's address is its path, with index.md at its folder's", () => {
	expect(pathOf("../../content/sidor/integritet.md")).toBe("integritet");
	expect(pathOf("../../content/sidor/hjalp/moten.md")).toBe("hjalp/moten");
	expect(pathOf("../../content/sidor/hjalp/index.md")).toBe("hjalp");
});

test("the header gives title, description, date and footer place", () => {
	const p = parsePage(
		"content/sidor/villkor.md",
		page(
			"Text.",
			"title: Användarvillkor\ndescription: Om: villkoren\nupdated: 2026-11-23\nfooter: 3",
		),
	);
	expect(p).toMatchObject({
		path: "villkor",
		title: "Användarvillkor",
		description: "Om: villkoren",
		updated: "2026-11-23",
		footer: 3,
		html: "<p>Text.</p>\n",
	});
	expect(parsePage("content/sidor/a.md", page("")).footer).toBeNull();
});

test("a broken header is reported with the file's name", () => {
	expect(() => parsePage("content/sidor/a.md", "Bara text")).toThrow(
		"content/sidor/a.md",
	);
	expect(() =>
		parsePage("content/sidor/a.md", page("", "description: x")),
	).toThrow('"title" saknas');
	expect(() =>
		parsePage("content/sidor/a.md", page("", "title: A\nupdated: 23/11")),
	).toThrow("ÅÅÅÅ-MM-DD");
	expect(() =>
		parsePage("content/sidor/a.md", page("", "title: A\nfooter: x")),
	).toThrow("ska vara ett tal");
});

test("headings get ids to link to, and the page's title is its only h1", () => {
	const { html } = parsePage(
		"content/sidor/a.md",
		page(
			"## Vilka uppgifter vi sparar\n\n### Åtgärder & *mer*\n\n## Vilka uppgifter vi sparar",
		),
	);
	expect(html).toContain('<h2 id="vilka-uppgifter-vi-sparar">');
	expect(html).toContain('<h3 id="atgarder-mer">');
	expect(html).toContain('<h2 id="vilka-uppgifter-vi-sparar-2">');
	expect(headingId("Kakor och lagring i webbläsaren")).toBe(
		"kakor-och-lagring-i-webblasaren",
	);
	expect(() => parsePage("content/sidor/a.md", page("# Rubrik"))).toThrow("##");
});

test("two files with the same address are refused", () => {
	expect(() =>
		readPages({
			"content/sidor/hjalp.md": page(""),
			"content/sidor/hjalp/index.md": page(""),
		}),
	).toThrow("/hjalp");
});

// The real pages in content/sidor/: a mistake in one fails here, not in production.
test("every page in content/sidor/ can be read", () => {
	const pages = allPages();
	expect(pages.size).toBeGreaterThan(0);
	for (const p of pages.values()) expect(p.title).not.toBe("");
});

test("pages are found by address; others are not", () => {
	expect(findPage("integritet")?.title).toBe("Integritetspolicy");
	expect(findPage("/hjalp/")?.title).toBe("Hjälp");
	expect(findPage("finns-inte")).toBeNull();
	expect(findPage("")).toBeNull();
});

test("links between pages lead to pages that exist", () => {
	const pages = allPages();
	for (const p of pages.values())
		for (const [, target] of p.html.matchAll(/href="\/([^"#]*)/g))
			expect(pages.has(target), `/${p.path} links to /${target}`).toBe(true);
});

test("the footer lists the pages marked for it, in order", () => {
	const links = footerLinks();
	expect(links.map((l) => l.path)).toEqual([
		"hjalp",
		"integritet",
		"villkor",
		"tillganglighet",
	]);
});
