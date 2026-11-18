import { expect, test } from "vitest";
import { excerpt, highlight, matchesAll, searchWords } from "./search";

test("every word must be found, ignoring case, also Å Ä Ö", () => {
	const words = searchWords("  ÅRSMÖTE  hiss ");
	expect(words).toEqual(["årsmöte", "hiss"]);
	expect(matchesAll(["Inför årsmötet", "Hissen besiktigas"], words)).toBe(true);
	expect(matchesAll(["Inför årsmötet"], words)).toBe(false);
	expect(matchesAll(["något"], [])).toBe(false);
});

test("long texts are cut around the first word found", () => {
	const text = `${"Inledning. ".repeat(30)}Hissen ska besiktigas i mars. ${"Avslutning. ".repeat(30)}`;
	const piece = excerpt(text, ["hiss"]);
	expect(piece).toContain("Hissen ska besiktigas");
	expect(piece.startsWith("…")).toBe(true);
	expect(piece.endsWith("…")).toBe(true);
	expect(excerpt("Kort text.", ["kort"])).toBe("Kort text.");
});

test("the searched words are marked", () => {
	expect(highlight("Hissen och hissarna", ["hiss"])).toEqual([
		{ text: "Hiss", hit: true },
		{ text: "en och ", hit: false },
		{ text: "hiss", hit: true },
		{ text: "arna", hit: false },
	]);
	expect(highlight("a.b", ["."])).toEqual([
		{ text: "a", hit: false },
		{ text: ".", hit: true },
		{ text: "b", hit: false },
	]);
});
