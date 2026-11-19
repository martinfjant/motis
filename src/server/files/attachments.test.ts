import { createClient } from "@libsql/client";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
	createAgenda,
	deleteItem,
	getAgenda,
	listTemplates,
	moveItem,
} from "../agendas.server";
import { createUser } from "../auth.server";
import { BoardError, createBoard } from "../boards.server";
import { migrate } from "../migrate";
import {
	closeProtocol,
	createProtocol,
	getProtocol,
	saveItemValue,
} from "../protocols.server";
import { protocolFingerprint } from "../reviews.server";
import { settleRemainingPoints } from "../test-helpers";
import {
	addAttachment,
	attachmentData,
	deleteAttachment,
	listAttachments,
	renumberText,
	replaceAttachment,
} from "./attachments.server";
import { getFileStorage } from "./storage.server";

let db: ReturnType<typeof createClient>;
let anna: string;
let cia: string;
let agendaId: string;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-20T17:00:00Z"));
});
afterEach(() => vi.useRealTimers());

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
	cia = await mk("cia");
	const boardId = (await createBoard(db, anna, "BRF Björken")).id;
	const [template] = await listTemplates(db, anna, boardId);
	agendaId = (
		await createAgenda(db, anna, boardId, {
			title: "Höstmöte",
			meetingAt: "2026-11-20T18:00",
			location: "",
			templateId: template.id,
		})
	).id;
});

async function pdf(text: string) {
	const doc = await PDFDocument.create();
	doc.addPage().drawText(text);
	return { name: `${text}.pdf`, data: await doc.save() };
}

async function agendaPoint(title: string) {
	const { items } = await getAgenda(db, anna, agendaId);
	const found = items.find((i) => i.title === title);
	if (!found) throw new Error(title);
	return found.id;
}

test("attachments are numbered through the meeting, in point order", async () => {
	const ekonomi = await agendaPoint("Ekonomi");
	const drift = await agendaPoint("Driftsfrågor");
	await addAttachment(db, anna, "agenda", drift, await pdf("Offert"));
	await addAttachment(db, anna, "agenda", ekonomi, await pdf("Budget"));
	await addAttachment(db, anna, "agenda", ekonomi, await pdf("Bokslut"));
	const list = await listAttachments(db, "agenda", agendaId);
	expect(list.map((a) => [a.number, a.name])).toEqual([
		[1, "Budget.pdf"],
		[2, "Bokslut.pdf"],
		[3, "Offert.pdf"],
	]);
	// Only for matters to discuss, and only for the board's members.
	await expect(
		addAttachment(
			db,
			anna,
			"agenda",
			await agendaPoint("Mötets öppnande"),
			await pdf("X"),
		),
	).rejects.toThrow("beslutspunkter och fritextpunkter");
	await expect(
		addAttachment(db, cia, "agenda", ekonomi, await pdf("X")),
	).rejects.toThrow(BoardError);
});

test("only PDFs and pictures; pictures lose their metadata", async () => {
	const ekonomi = await agendaPoint("Ekonomi");
	await expect(
		addAttachment(db, anna, "agenda", ekonomi, {
			name: "Budget.docx",
			data: new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]),
		}),
	).rejects.toThrow("PDF:er eller bilder");
	await expect(
		addAttachment(db, anna, "agenda", ekonomi, {
			name: "trasig.pdf",
			data: new TextEncoder().encode("%PDF-1.7 inget mer"),
		}),
	).rejects.toThrow("går inte att läsa");

	const photo = await sharp({
		create: { width: 4000, height: 3000, channels: 3, background: "#888" },
	})
		.webp()
		.withExif({ IFD0: { Make: "Telefon" } })
		.toBuffer();
	const added = await addAttachment(db, anna, "agenda", ekonomi, {
		name: "../../Kvitto.webp",
		data: new Uint8Array(photo),
	});
	expect(added.name).toBe("Kvitto.jpg");
	expect(added.contentType).toBe("image/jpeg");
	const stored = await attachmentData(db, added.id);
	const meta = await sharp(stored ?? undefined).metadata();
	expect(meta.width).toBe(3000);
	expect(meta.exif).toBeUndefined();
});

test("references follow when numbers change", async () => {
	expect(
		renumberText(
			"Se Bilaga 1 och Bilaga 2, inte Bilaga 22.",
			new Map([
				[1, 2],
				[2, 1],
				[22, null],
			]),
		),
	).toBe("Se Bilaga 2 och Bilaga 1, inte Bilaga (borttagen).");

	const ekonomi = await agendaPoint("Ekonomi");
	const drift = await agendaPoint("Driftsfrågor");
	const budget = await addAttachment(
		db,
		anna,
		"agenda",
		ekonomi,
		await pdf("Budget"),
	);
	await addAttachment(db, anna, "agenda", drift, await pdf("Offert"));
	// The meeting starts: the protocol gets the same attachments.
	const protocol = await createProtocol(db, anna, agendaId);
	const items = (await getProtocol(db, anna, protocol.id)).items;
	const id = (title: string) => items.find((i) => i.title === title)?.id ?? "";
	await saveItemValue(db, anna, id("Driftsfrågor"), {
		notes: "Offerten finns i Bilaga 2, budgeten i Bilaga 1.",
	});
	const listed = await listAttachments(db, "protocol", protocol.id);
	expect(listed.map((a) => [a.number, a.name])).toEqual([
		[1, "Budget.pdf"],
		[2, "Offert.pdf"],
	]);

	// Moving Driftsfrågor up swaps the numbers, and the notes with them.
	await moveItem(db, anna, "protocol", id("Driftsfrågor"), -1);
	const notes = async () =>
		(await getProtocol(db, anna, protocol.id)).items.find(
			(i) => i.title === "Driftsfrågor",
		)?.value.notes;
	expect(await notes()).toBe("Offerten finns i Bilaga 1, budgeten i Bilaga 2.");

	// Removing the budget from the protocol: its references say so.
	const [, protocolBudget] = await listAttachments(db, "protocol", protocol.id);
	await deleteAttachment(db, anna, "protocol", protocolBudget.id);
	expect(await notes()).toBe(
		"Offerten finns i Bilaga 1, budgeten i Bilaga (borttagen).",
	);
	// The agenda keeps its own, so the file stays.
	expect(await attachmentData(db, budget.id)).not.toBeNull();
});

test("files go when nothing uses them; deleting a point takes its attachments", async () => {
	const ekonomi = await agendaPoint("Ekonomi");
	const a = await addAttachment(db, anna, "agenda", ekonomi, await pdf("A"));
	const key = `bilagor/${a.sha256}`;
	const storage = await getFileStorage();
	expect(await storage.get(key)).not.toBeNull();

	await replaceAttachment(db, anna, "agenda", a.id, await pdf("B"));
	expect(await storage.get(key)).toBeNull();
	const [replaced] = await listAttachments(db, "agenda", agendaId);
	expect([replaced.number, replaced.name]).toEqual([1, "B.pdf"]);

	await deleteItem(db, anna, "agenda", ekonomi);
	expect(await listAttachments(db, "agenda", agendaId)).toEqual([]);
	expect(await storage.get(`bilagor/${replaced.sha256}`)).toBeNull();
});

test("a closed protocol's attachments change only when editing it, and justering notices", async () => {
	const protocol = await createProtocol(db, anna, agendaId);
	const items = (await getProtocol(db, anna, protocol.id)).items;
	const ekonomi = items.find((i) => i.title === "Ekonomi")?.id ?? "";
	await settleRemainingPoints(db, protocol.id);
	await closeProtocol(db, anna, protocol.id);
	const before = await protocolFingerprint(db, protocol.id);

	await expect(
		addAttachment(db, anna, "protocol", ekonomi, await pdf("Sen")),
	).rejects.toThrow("Redigera protokollet");
	await addAttachment(
		db,
		anna,
		"protocol",
		ekonomi,
		await pdf("Sen"),
		crypto.randomUUID(),
	);
	expect(await protocolFingerprint(db, protocol.id)).not.toBe(before);
});
