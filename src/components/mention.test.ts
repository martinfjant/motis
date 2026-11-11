import { expect, test } from "vitest";
import { findMention, matchPeople } from "./MentionTextarea";

test("an @ starts a mention at the start or after whitespace", () => {
	expect(findMention("@m", 2)).toEqual({ start: 0, query: "m" });
	expect(findMention("Hej @An", 7)).toEqual({ start: 4, query: "An" });
	expect(findMention("Rad ett\n@", 9)).toEqual({ start: 8, query: "" });
	// Names with spaces keep matching while typed.
	expect(findMention("@Anna A", 7)).toEqual({ start: 0, query: "Anna A" });
});

test("no mention in e-mail addresses, across lines, or before the @", () => {
	expect(findMention("anna@example.se", 15)).toBeNull();
	expect(findMention("@Anna\nsa", 8)).toBeNull();
	expect(findMention("ab @cd", 2)).toBeNull();
	expect(findMention("ingen snabel-a", 14)).toBeNull();
});

test("matching is by the start of the name, ignoring case", () => {
	const people = [
		{ name: "Anna Andersson", label: "Anna Andersson (Vice ordförande)" },
		{ name: "Martin Berg", label: "Martin Berg" },
		{ name: "Åsa Öberg", label: "Åsa Öberg (Kassör)" },
	];
	const names = (q: string) => matchPeople(people, q).map((p) => p.name);
	expect(names("")).toEqual(["Anna Andersson", "Martin Berg", "Åsa Öberg"]);
	expect(names("m")).toEqual(["Martin Berg"]);
	expect(names("ÅS")).toEqual(["Åsa Öberg"]);
	expect(names("anna a")).toEqual(["Anna Andersson"]);
	expect(names("Berg")).toEqual([]);
});
