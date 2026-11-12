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

test("only a real, small PNG is accepted as a signature", () => {
	expect(cleanSignature(PNG)).toBe(PNG);
	for (const bad of [
		"",
		"data:image/svg+xml;base64,PHN2Zz4=",
		"data:image/png;base64,bm90IGEgcG5n",
		"data:image/png;base64,<script>",
		`data:image/png;base64,${Buffer.alloc(300_000).toString("base64")}`,
	])
		expect(() => cleanSignature(bad)).toThrow(BoardError);
});

test("approving needs a signature, which is kept with the approval", async () => {
	await closeProtocol(db, anna, protocolId);
	await sendForReview(db, anna, protocolId);
	const token =
		/\/justera\/([\w-]+)/.exec((await listOutbox(db))[0].text)?.[1] ?? "";
	await expect(
		decideReview(db, token, { approve: true, comment: "" }),
	).rejects.toThrow(/Rita din signatur/);
	await decideReview(db, token, { approve: true, comment: "", signature: PNG });
	const doc = await documentForMember(db, anna, protocolId);
	expect(doc.justering).toEqual({
		reviewers: [
			{ name: "bo", approvedAt: "2026-11-20T17:00:00.000Z", signature: PNG },
		],
	});
});

test("downloads need a closed protocol, and a member or the share link", async () => {
	await expect(documentForMember(db, anna, protocolId)).rejects.toThrow(
		/när det är stängt/,
	);
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
	await closeProtocol(db, anna, protocolId);
	await sendForReview(db, anna, protocolId);
	const token =
		/\/justera\/([\w-]+)/.exec((await listOutbox(db))[0].text)?.[1] ?? "";
	await decideReview(db, token, { approve: true, comment: "", signature: PNG });

	const doc = await documentForMember(db, anna, protocolId);
	const md = protocolMarkdown(doc);
	expect(md).toMatch(
		/^# Protokoll: Höstmöte\n\nBRF Björken\n\n- \*\*Tid:\*\* 20-11-2026 18:00\n- \*\*Plats:\*\* Lokalen\n/,
	);
	expect(md).toContain("### 1. Mötets öppnande");
	expect(md).toContain("Närvarande:\n\n- anna\n- bo");
	expect(md).toContain("Vald: **anna**");
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
	await closeProtocol(db, anna, protocolId);
	const plain = await protocolPdf(
		await documentForMember(db, anna, protocolId),
	);
	expect(plain.subarray(0, 5).toString()).toBe("%PDF-");

	await sendForReview(db, anna, protocolId);
	const token =
		/\/justera\/([\w-]+)/.exec((await listOutbox(db))[0].text)?.[1] ?? "";
	await decideReview(db, token, { approve: true, comment: "", signature: PNG });
	const signed = await protocolPdf(
		await documentForMember(db, anna, protocolId),
	);
	expect(signed.subarray(0, 5).toString()).toBe("%PDF-");
	// The signature is embedded as an image.
	expect(signed.toString("latin1")).toContain("/Subtype /Image");
	expect(plain.toString("latin1")).not.toContain("/Subtype /Image");
});

test("escaping keeps text as written", () => {
	expect(escapeMarkdown("1. inte en lista\n- inte heller\n_ord_ [länk]")).toBe(
		"1\\. inte en lista  \n\\- inte heller  \n\\_ord\\_ \\[länk\\]",
	);
});
