import { createClient } from "@libsql/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
	createAgenda,
	getAgenda,
	listTemplates,
	mergeCarried,
} from "./agendas.server";
import { createUser } from "./auth.server";
import { BoardError, createBoard } from "./boards.server";
import type { ItemType } from "./items";
import { callMeeting, getMeetingPlan, listUpcoming } from "./meetings.server";
import { migrate } from "./migrate";
import {
	closeProtocol,
	createProtocol,
	getProtocol,
	saveItemValue,
	setCarryOver,
} from "./protocols.server";

let db: ReturnType<typeof createClient>;
let anna: string, boardId: string, templateId: string, protocolId: string;
const now = new Date("2026-11-11T12:00:00Z");

/** The ids of the protocol's points, by title. */
async function points() {
	const { items } = await getProtocol(db, anna, protocolId);
	return Object.fromEntries(items.map((i) => [i.title, i]));
}

// The protocol is started on the meeting's day, 2026-11-05.
beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-05T17:00:00Z"));
});
afterEach(() => {
	vi.useRealTimers();
});

beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	anna = (
		await createUser(db, {
			name: "Anna",
			email: "anna@example.se",
			password: "hemligt123",
		})
	).id;
	boardId = (await createBoard(db, anna, "BRF Björken")).id;
	templateId = (await listTemplates(db, anna, boardId))[0].id;
	const agenda = await createAgenda(db, anna, boardId, {
		title: "Novembermöte",
		meetingAt: "2026-11-05T18:00",
		location: "Lokalen",
		templateId,
	});
	const p = await getAgenda(db, anna, agenda.id);
	// Two extra matters to discuss at this meeting.
	for (const [i, title] of ["Takreparation", "Cykelrum"].entries()) {
		await db.execute({
			sql: `INSERT INTO agenda_items (id, agenda_id, position, title, type, description)
            VALUES (?, ?, ?, ?, 'decision', 'Offerter finns.')`,
			args: [crypto.randomUUID(), p.agenda.id, 100 + i, title],
		});
	}
	protocolId = (await createProtocol(db, anna, agenda.id)).id;
});

test("the default template has a next-meeting point", async () => {
	const pts = await points();
	expect(pts["Nästa möte"].type).toBe("next_meeting");
	await expect(
		saveItemValue(db, anna, pts["Nästa möte"].id, {}),
	).rejects.toThrow("Ange datum och tid för nästa möte.");
	await saveItemValue(db, anna, pts["Nästa möte"].id, {
		at: "2026-12-03T18:00",
	});
	expect((await points())["Nästa möte"].value.at).toBe("2026-12-03T18:00");
});

test("a tabled point needs no decision and keeps its flag when notes are saved", async () => {
	const { Takreparation } = await points();
	await setCarryOver(db, anna, Takreparation.id, { tabled: true });
	await saveItemValue(db, anna, Takreparation.id, {
		notes: "Väntar på en tredje offert.",
	});
	expect((await points()).Takreparation.value).toEqual({
		tabled: true,
		notes: "Väntar på en tredje offert.",
	});
	await setCarryOver(db, anna, Takreparation.id, { tabled: false });
	expect((await points()).Takreparation.value).toEqual({
		notes: "Väntar på en tredje offert.",
	});
});

test("follow-up survives saving the decision; a decided point can't be tabled", async () => {
	const { Cykelrum, Takreparation } = await points();
	await setCarryOver(db, anna, Cykelrum.id, { followUp: true });
	await saveItemValue(db, anna, Cykelrum.id, { decision: "Vi rensar i maj." });
	expect((await points()).Cykelrum.value).toEqual({
		decision: "Vi rensar i maj.",
		followUp: true,
	});
	await expect(
		setCarryOver(db, anna, Cykelrum.id, { tabled: true }),
	).rejects.toThrow("Punkten är redan klar och kan inte bordläggas.");

	// Tabling a point marked for follow-up clears the follow-up.
	await setCarryOver(db, anna, Takreparation.id, { followUp: true });
	await setCarryOver(db, anna, Takreparation.id, { tabled: true });
	expect((await points()).Takreparation.value).toEqual({ tabled: true });
});

test("formalities can't be tabled", async () => {
	const pts = await points();
	await expect(
		setCarryOver(db, anna, pts["Närvarande ledamöter"].id, { tabled: true }),
	).rejects.toThrow(BoardError);
});

test("calling the next meeting starts from what the last one decided", async () => {
	const pts = await points();
	await saveItemValue(db, anna, pts["Nästa möte"].id, {
		at: "2026-12-03T18:00",
	});
	await setCarryOver(db, anna, pts.Takreparation.id, { tabled: true });
	await saveItemValue(db, anna, pts.Cykelrum.id, {
		decision: "Vi rensar i maj.",
	});
	await setCarryOver(db, anna, pts.Cykelrum.id, { followUp: true });
	await saveItemValue(db, anna, pts.Ekonomi.id, { notes: "Se över budgeten." });
	await setCarryOver(db, anna, pts.Ekonomi.id, { followUp: true });
	await closeProtocol(db, anna, protocolId);

	const plan = await getMeetingPlan(db, anna, boardId, now);
	expect(plan.nextAt).toBe("2026-12-03T18:00");
	expect(plan.location).toBe("Lokalen");
	expect(plan.carryOver.map((c) => [c.title, c.reason])).toEqual([
		["Ekonomi", "followUp"],
		["Takreparation", "tabled"],
		["Cykelrum", "followUp"],
	]);
	expect(plan.carryOver[2].description).toBe(
		"Uppföljning från mötet 05-11-2026.\n\nOfferter finns.\n\nBeslut: Vi rensar i maj.",
	);

	// Only Takreparation is chosen; an unrelated id is ignored.
	const agenda = await callMeeting(db, anna, boardId, {
		title: "Decembermöte",
		meetingAt: plan.nextAt,
		location: plan.location,
		templateId,
		carryOver: [pts.Takreparation.id, pts.Ekonomi.id, "not-a-point"],
	});
	const { items } = await getAgenda(db, anna, agenda.id);
	const titles = items.map((i) => i.title);
	// Ekonomi is a standing point: it gets the note instead of a second copy.
	expect(titles.filter((t) => t === "Ekonomi")).toHaveLength(1);
	expect(items.find((i) => i.title === "Ekonomi")?.description).toBe(
		"Uppföljning från mötet 05-11-2026.\n\nSe över budgeten.",
	);
	expect(titles.slice(-4)).toEqual([
		"Takreparation",
		"Övriga frågor",
		"Nästa möte",
		"Mötets avslutande",
	]);
	expect(titles).not.toContain("Cykelrum");
	expect(titles.filter((t) => t === "Takreparation")).toHaveLength(1);

	// The meeting is now called, and Takreparation is on an agenda.
	const after = await getMeetingPlan(db, anna, boardId, now);
	expect(after.nextAt).toBe("");
	expect(after.carryOver.map((c) => c.title)).toEqual(["Cykelrum"]);
});

test("upcoming meetings list called and planned meetings, soonest first", async () => {
	const pts = await points();
	await saveItemValue(db, anna, pts["Nästa möte"].id, {
		at: "2026-12-03T18:00",
	});
	expect(await listUpcoming(db, anna, undefined, now)).toEqual([
		{
			boardId,
			boardName: "BRF Björken",
			meetingAt: "2026-12-03T18:00",
			daysUntil: 22,
			agenda: null,
		},
	]);

	const other = (await createBoard(db, anna, "BRF Eken")).id;
	const agenda = await createAgenda(db, anna, other, {
		title: "Extramöte",
		meetingAt: "2026-11-12T19:00",
		location: "",
	});
	const upcoming = await listUpcoming(db, anna, undefined, now);
	expect(upcoming.map((m) => [m.boardName, m.daysUntil, m.agenda?.id])).toEqual(
		[
			["BRF Eken", 1, agenda.id],
			["BRF Björken", 22, undefined],
		],
	);
	// Meetings in the past are not upcoming.
	expect(
		await listUpcoming(db, anna, undefined, new Date("2027-01-01T12:00:00Z")),
	).toEqual([]);
});

test("carried points merge into standing points, others go before Övriga frågor", () => {
	const it = (
		title: string,
		type: ItemType = "text",
		sourceItemId?: string,
	) => ({
		title,
		type,
		description: "",
		extraNames: [],
		sourceItemId,
	});
	const carried = [
		{ ...it("ekonomi", "text", "p1"), description: "Uppföljning." },
		it("Takreparation", "decision", "p2"),
	];
	const result = mergeCarried(
		[
			it("Ekonomi"),
			it("Övriga frågor"),
			it("Nästa möte", "next_meeting"),
			it("Mötets avslutande", "close"),
		],
		carried,
	);
	expect(result.map((i) => [i.title, i.description, i.sourceItemId])).toEqual([
		["Ekonomi", "Uppföljning.", "p1"],
		["Takreparation", "", "p2"],
		["Övriga frågor", "", undefined],
		["Nästa möte", "", undefined],
		["Mötets avslutande", "", undefined],
	]);
	expect(
		mergeCarried([it("A"), it("Slut", "close")], [it("B")]).map((i) => i.title),
	).toEqual(["A", "B", "Slut"]);
	expect(mergeCarried([], [it("B")]).map((i) => i.title)).toEqual(["B"]);
});
