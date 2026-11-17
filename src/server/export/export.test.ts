import { createClient } from "@libsql/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAgenda, listTemplates } from "../agendas.server";
import { createUser } from "../auth.server";
import { addMemberByEmail, BoardError, createBoard } from "../boards.server";
import { listOutbox } from "../mail/send.server";
import { migrate } from "../migrate";
import {
	closeProtocol,
	createProtocol,
	getProtocol,
	saveItemValue,
} from "../protocols.server";
import { decideReview, sendForReview } from "../reviews.server";
import { cleanSignature } from "../signature.server";
import { settleRemainingPoints } from "../test-helpers";
import { DRAWN_SIGNATURE } from "../test-signature";
import {
	documentForMember,
	documentForShare,
	fileName,
} from "./document.server";
import { escapeMarkdown, protocolMarkdown } from "./markdown.server";
import { protocolPdf } from "./pdf.server";

const PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let db: ReturnType<typeof createClient>;
let anna: string, bo: string, protocolId: string, shareId: string;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-20T17:00:00Z"));
	vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	const mk = async (name: string) =>
		(
			await createUser(db, {
				name,
				email: `${name}@example.se`,
				password: "hemligt123",
			})
		).id;
	anna = await mk("anna");
	bo = await mk("bo");
	const boardId = (await createBoard(db, anna, "BRF Björken")).id;
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	const [tpl] = await listTemplates(db, anna, boardId);
	const agenda = await createAgenda(db, anna, boardId, {
		title: "Höstmöte",
		meetingAt: "2026-11-20T18:00",
		location: "Lokalen",
		templateId: tpl.id,
	});
	const protocol = await createProtocol(db, anna, agenda.id);
	protocolId = protocol.id;
	shareId = protocol.shareId;
	const { items } = await getProtocol(db, anna, protocolId);
	const id = (t: string) => items.find((i) => i.title === t)?.id ?? "";
	await saveItemValue(db, anna, id("Närvarande ledamöter"), {
		present: ["anna", "bo"],
	});
	await saveItemValue(db, anna, id("Val av sekreterare"), { person: "anna" });
	await saveItemValue(db, anna, id("Val av justerare"), {
		reviewers: [{ name: "", member: `user:${bo}` }],
	});
	await saveItemValue(db, anna, id("Ekonomi"), {
		notes: "# inte en rubrik, *inte fet*\n\nAndra stycket.",
	});
});

test("only a clean SVG drawing is accepted, and stored as rewritten", () => {
	const stored = cleanSignature(DRAWN_SIGNATURE);
	expect(stored).toBe(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 160" width="448" height="160"><g fill="none" stroke="#1c1917" stroke-linecap="round"><path d="M 10.000,20.000 C 30.000,60.000 60.000,20.000 90.000,80.000" stroke-width="3.15"/><circle cx="120" cy="90" r="1.7" fill="#1c1917" stroke="none"/></g></svg>',
	);
	// What we store reads back the same.
	expect(cleanSignature(stored)).toBe(stored);
	const svg = (inner: string) =>
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 160">${inner}</svg>`;
	for (const bad of [
		"",
		PNG, // new signatures are SVG
		svg(""), // nothing drawn
		svg("<script>alert(1)</script>"),
		svg('<path d="M 1,2 C 3,4 5,6 7,8" stroke-width="2" onload="alert(1)"/>'),
		svg('<path d="M 1,2 L 300,400 Z" stroke-width="2"/>'),
		svg('<image href="https://example.com/x.png"/>'),
		svg('<circle cx="1" cy="2" r="url(#x)"/>'),
		svg('<a href="javascript:alert(1)"><circle cx="1" cy="2" r="3"/></a>'),
		svg("&lt;"),
		svg("text"),
		`<!DOCTYPE svg>${svg('<circle cx="1" cy="2" r="3"/>')}`,
		svg('<circle cx="1" cy="2" r="3"/>'.repeat(30_000)),
	])
		expect(() => cleanSignature(bad)).toThrow(BoardError);
});

test("approving needs a signature, which is kept with the approval", async () => {
	await settleRemainingPoints(db, protocolId);
	await closeProtocol(db, anna, protocolId);
	await sendForReview(db, anna, protocolId);
	const token =
		/\/justera\/([\w-]+)/.exec((await listOutbox(db))[0].text)?.[1] ?? "";
	await expect(
		decideReview(db, token, { approve: true, comment: "" }),
	).rejects.toThrow(/Rita din signatur/);
	await decideReview(db, token, {
		approve: true,
		comment: "",
		signature: DRAWN_SIGNATURE,
	});
	const doc = await documentForMember(db, anna, protocolId);
	expect(doc.justering).toEqual({
		reviewers: [
			{
				name: "bo",
				approvedAt: "2026-11-20T17:00:00.000Z",
				signature: cleanSignature(DRAWN_SIGNATURE),
			},
		],
	});
});

test("downloads need a closed protocol, and a member or the share link", async () => {
	await expect(documentForMember(db, anna, protocolId)).rejects.toThrow(
		/när det är stängt/,
	);
	await settleRemainingPoints(db, protocolId);
	await closeProtocol(db, anna, protocolId);
	const cia = (
		await createUser(db, {
			name: "cia",
			email: "cia@example.se",
			password: "hemligt123",
		})
	).id;
	await expect(documentForMember(db, cia, protocolId)).rejects.toThrow(
		BoardError,
	);
	expect(await documentForShare(db, "fel")).toBeNull();
	expect((await documentForShare(db, shareId))?.title).toBe("Höstmöte");
	// Not justerat yet.
	expect((await documentForShare(db, shareId))?.justering).toBeNull();
});

test("the Markdown has the points in order, as written, and the justering", async () => {
	await settleRemainingPoints(db, protocolId);
	await closeProtocol(db, anna, protocolId);
	await sendForReview(db, anna, protocolId);
	const token =
		/\/justera\/([\w-]+)/.exec((await listOutbox(db))[0].text)?.[1] ?? "";
	await decideReview(db, token, {
		approve: true,
		comment: "",
		signature: DRAWN_SIGNATURE,
	});

	const doc = await documentForMember(db, anna, protocolId);
	const md = protocolMarkdown(doc);
	expect(md).toMatch(
		/^# Protokoll: Höstmöte\n\nBRF Björken\n\n- \*\*Tid:\*\* 20-11-2026 18:00\n- \*\*Plats:\*\* Lokalen\n/,
	);
	expect(md).toContain("### 1. Mötets öppnande");
	expect(md).toContain("Närvarande:\n\n- anna\n- bo");
	expect(md).toContain("Mötet väljer: **anna**");
	expect(md).toContain("Justerare: **bo**");
	// Someone's note can't turn into formatting.
	expect(md).toContain("\\# inte en rubrik, \\*inte fet\\*\n\nAndra stycket.");
	expect(md).toContain(
		"## Historik\n\n- Protokollet stängdes 20-11-2026 18:00.",
	);
	expect(md).toContain(
		"## Justering\n\nProtokollet är justerat av:\n\n- bo, signerat digitalt 20-11-2026 18:00",
	);
	expect(fileName(doc, "md")).toBe("Protokoll Höstmöte 2026-11-20.md");
});

test("the PDF is a PDF, with the signature in it", async () => {
	await settleRemainingPoints(db, protocolId);
	await closeProtocol(db, anna, protocolId);
	const plain = await protocolPdf(
		await documentForMember(db, anna, protocolId),
	);
	expect(plain.subarray(0, 5).toString()).toBe("%PDF-");

	await sendForReview(db, anna, protocolId);
	const token =
		/\/justera\/([\w-]+)/.exec((await listOutbox(db))[0].text)?.[1] ?? "";
	await decideReview(db, token, {
		approve: true,
		comment: "",
		signature: DRAWN_SIGNATURE,
	});
	const signed = await protocolPdf(
		await documentForMember(db, anna, protocolId),
	);
	expect(signed.subarray(0, 5).toString()).toBe("%PDF-");
	// The signature is drawn in as vector shapes, not an image.
	expect(signed.length).toBeGreaterThan(plain.length);
	expect(signed.toString("latin1")).not.toContain("/Subtype /Image");

	// Older approvals hold a PNG: that is still embedded, as an image.
	const doc = await documentForMember(db, anna, protocolId);
	if (!doc.justering) throw new Error("expected justering");
	doc.justering.reviewers[0].signature = PNG;
	const legacy = await protocolPdf(doc);
	expect(legacy.toString("latin1")).toContain("/Subtype /Image");
});

test("escaping keeps text as written", () => {
	expect(escapeMarkdown("1. inte en lista\n- inte heller\n_ord_ [länk]")).toBe(
		"1\\. inte en lista  \n\\- inte heller  \n\\_ord\\_ \\[länk\\]",
	);
});
