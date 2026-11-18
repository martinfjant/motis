import { expect, test } from "vitest";
import { matchRefs, refText, splitRefs } from "./protocol-refs";

const refs = [
	{ id: "a", title: "Styrelsemöte", date: "12-11-2026" },
	{ id: "b", title: "Extrainsatt möte", date: "03-12-2026" },
	{ id: "c", title: "Styrelsemöte", date: "10-12-2026" },
];

test("a reference is written with title and date", () => {
	expect(refText(refs[0])).toBe("#Styrelsemöte 12-11-2026");
});

test("typing narrows by title or date, ignoring case", () => {
	const ids = (q: string) => matchRefs(refs, q).map((r) => r.id);
	expect(ids("")).toEqual(["a", "b", "c"]);
	expect(ids("extra")).toEqual(["b"]);
	expect(ids("STYRELSE")).toEqual(["a", "c"]);
	expect(ids("12-2026")).toEqual(["b", "c"]);
	expect(ids("styrelsemöte 12-11")).toEqual(["a"]);
	expect(ids("årsmöte")).toEqual([]);
});

test("typing a Swedish month name finds that month's meetings", () => {
	const ids = (q: string) => matchRefs(refs, q).map((r) => r.id);
	expect(ids("nov")).toEqual(["a"]);
	expect(ids("December")).toEqual(["b", "c"]);
	expect(ids("dec 2026")).toEqual(["b", "c"]);
	expect(ids("styrelse dec")).toEqual(["c"]);
	expect(ids("mars")).toEqual([]);
});

test("references to known protocols are found in text", () => {
	expect(splitRefs("Se #Styrelsemöte 12-11-2026, punkt 8.", refs)).toEqual([
		"Se ",
		refs[0],
		", punkt 8.",
	]);
	expect(
		splitRefs(
			"#Extrainsatt möte 03-12-2026 och #Styrelsemöte 10-12-2026",
			refs,
		),
	).toEqual([refs[1], " och ", refs[2]]);
});

test("unknown references and plain text stay text", () => {
	expect(splitRefs("Inga hänvisningar.", refs)).toEqual(["Inga hänvisningar."]);
	// No such meeting (renamed, deleted or another board's).
	expect(splitRefs("#Årsmöte 01-04-2026", refs)).toEqual([
		"#Årsmöte 01-04-2026",
	]);
	// Without the date it is not a reference.
	expect(splitRefs("#Styrelsemöte", refs)).toEqual(["#Styrelsemöte"]);
	expect(splitRefs("#Styrelsemöte 12-11-2026", [])).toEqual([
		"#Styrelsemöte 12-11-2026",
	]);
});
