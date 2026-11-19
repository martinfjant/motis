import { createHash, randomUUID } from "node:crypto";
import type { Client, InStatement } from "@libsql/client";
import { requireParent } from "../agendas.server";
import { BoardError } from "../boards.server";
import { takesAttachments } from "../items";
import { guardProtocolEdit } from "../protocol-edits.server";
import { attachmentImage } from "./images.server";
import { getFileStorage } from "./storage.server";

// Files attached to points ("Bilaga 1", "Bilaga 2"…), on agendas and
// protocols. Added when the meeting is called, carried over to the protocol
// when it starts, and changeable until the protocol is closed (after that
// only through "Redigera protokollet", like everything else). Numbered per
// meeting in point order; when a number changes, "Bilaga N" in the
// meeting's texts is rewritten to keep pointing at the same file.

export type MeetingKind = "agenda" | "protocol";

export type Attachment = {
	id: string;
	itemId: string;
	/** "Bilaga <number>", counted through the meeting. */
	number: number;
	name: string;
	contentType: AttachmentType;
	size: number;
	sha256: string;
};

/** What can be attached: what browsers show and the PDF can append. */
export type AttachmentType = "application/pdf" | "image/jpeg" | "image/png";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const TABLE = {
	agenda: { items: "agenda_items", fk: "agenda_id" },
	protocol: { items: "protocol_items", fk: "protocol_id" },
} as const;

/** The meeting's attachments, numbered, in point order. */
export async function listAttachments(
	db: Client,
	kind: MeetingKind,
	parentId: string,
): Promise<Attachment[]> {
	const t = TABLE[kind];
	const res = await db.execute({
		sql: `SELECT a.* FROM attachments a
          JOIN ${t.items} i ON i.id = a.item_id
          WHERE a.item_kind = ? AND i.${t.fk} = ?
          ORDER BY i.position, i.id, a.position, a.id`,
		args: [kind, parentId],
	});
	return res.rows.map((r, i) => ({
		id: String(r.id),
		itemId: String(r.item_id),
		number: i + 1,
		name: String(r.name),
		contentType: String(r.content_type) as AttachmentType,
		size: Number(r.size),
		sha256: String(r.sha256),
	}));
}

/** The point an attachment belongs to, with its meeting, or an error. */
async function requireItem(
	db: Client,
	userId: string,
	kind: MeetingKind,
	itemId: string,
	editSession?: string,
) {
	const t = TABLE[kind];
	const res = await db.execute({
		sql: `SELECT ${t.fk} AS parent_id, type FROM ${t.items} WHERE id = ?`,
		args: [itemId],
	});
	const row = res.rows[0];
	if (!row) throw new BoardError("Punkten finns inte.");
	const parentId = String(row.parent_id);
	await requireParent(db, userId, kind, parentId);
	if (kind === "protocol")
		await guardProtocolEdit(db, userId, parentId, editSession);
	if (!takesAttachments(String(row.type)))
		throw new BoardError(
			"Bilagor kan bara läggas till beslutspunkter och fritextpunkter.",
		);
	return { parentId };
}

async function requireAttachment(
	db: Client,
	userId: string,
	kind: MeetingKind,
	attachmentId: string,
	editSession?: string,
) {
	const res = await db.execute({
		sql: "SELECT item_id, storage_key FROM attachments WHERE id = ? AND item_kind = ?",
		args: [attachmentId, kind],
	});
	const row = res.rows[0];
	if (!row) throw new BoardError("Bilagan finns inte.");
	const { parentId } = await requireItem(
		db,
		userId,
		kind,
		String(row.item_id),
		editSession,
	);
	return { parentId, storageKey: String(row.storage_key) };
}

/** A file as uploaded: its name and content. */
export type Upload = { name: string; data: Uint8Array };

/**
 * Checks what a file is by its content (never its name), and makes pictures
 * anew without their metadata. PDFs are kept as they are, but must be ones
 * that can be read (and so appended to the protocol's PDF).
 */
async function prepare(upload: Upload) {
	if (upload.data.length > MAX_ATTACHMENT_BYTES)
		throw new BoardError("Filen är för stor (högst 20 MB).");
	const startsWith = (bytes: number[], at = 0) =>
		bytes.every((b, i) => upload.data[at + i] === b);
	const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
	let data = upload.data;
	let contentType: AttachmentType;
	if (startsWith(ascii("%PDF-"))) {
		const { PDFDocument } = await import("pdf-lib");
		try {
			const doc = await PDFDocument.load(data, { ignoreEncryption: true });
			// Reading is forgiving: a file that only starts like a PDF has no pages.
			if (doc.getPageCount() === 0) throw new Error("no pages");
		} catch {
			throw new BoardError(
				"PDF:en går inte att läsa. Spara den på nytt och försök igen.",
			);
		}
		contentType = "application/pdf";
	} else if (
		startsWith([0x89, ...ascii("PNG")]) ||
		startsWith([0xff, 0xd8, 0xff]) ||
		(startsWith(ascii("RIFF")) && startsWith(ascii("WEBP"), 8))
	) {
		({ data, contentType } = await attachmentImage(data));
	} else {
		throw new BoardError(
			"Bilagor kan vara PDF:er eller bilder (JPEG, PNG eller WebP).",
		);
	}
	const sha256 = createHash("sha256").update(data).digest("hex");
	return {
		data,
		contentType,
		sha256,
		storageKey: `bilagor/${sha256}`,
		name: cleanName(upload.name, contentType),
	};
}

/** The file name, without folders or odd characters, with a fitting ending. */
function cleanName(name: string, contentType: AttachmentType) {
	const base =
		(name.split(/[\\/]/).at(-1) ?? "")
			.replace(/\p{Cc}+/gu, "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 150) || "Bilaga";
	const ending = {
		"application/pdf": ".pdf",
		"image/jpeg": ".jpg",
		"image/png": ".png",
	}[contentType];
	// A WebP picture became JPEG: say so in its name.
	const stem = base.replace(/\.(pdf|jpe?g|png|webp)$/i, "");
	return `${stem}${ending}`;
}

async function userName(db: Client, userId: string) {
	const res = await db.execute({
		sql: "SELECT name FROM users WHERE id = ?",
		args: [userId],
	});
	return String(res.rows[0]?.name ?? "");
}

/** Attaches a file to a point, last among the point's attachments. */
export async function addAttachment(
	db: Client,
	userId: string,
	kind: MeetingKind,
	itemId: string,
	upload: Upload,
	editSession?: string,
): Promise<Attachment> {
	const { parentId } = await requireItem(db, userId, kind, itemId, editSession);
	const file = await prepare(upload);
	await (await getFileStorage()).put(
		file.storageKey,
		file.data,
		file.contentType,
	);
	const id = randomUUID();
	await renumbering(db, kind, parentId, async () => {
		await db.execute({
			sql: `INSERT INTO attachments (id, item_kind, item_id, position, name, content_type, size, sha256, storage_key, created_at, created_by_name)
            VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM attachments WHERE item_kind = ? AND item_id = ?), ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				id,
				kind,
				itemId,
				kind,
				itemId,
				file.name,
				file.contentType,
				file.data.length,
				file.sha256,
				file.storageKey,
				new Date().toISOString(),
				await userName(db, userId),
			],
		});
	});
	const added = (await listAttachments(db, kind, parentId)).find(
		(a) => a.id === id,
	);
	if (!added) throw new Error("Bilagan sparades inte.");
	return added;
}

/** Puts a new file in an attachment's place; its number stays the same. */
export async function replaceAttachment(
	db: Client,
	userId: string,
	kind: MeetingKind,
	attachmentId: string,
	upload: Upload,
	editSession?: string,
) {
	const { storageKey } = await requireAttachment(
		db,
		userId,
		kind,
		attachmentId,
		editSession,
	);
	const file = await prepare(upload);
	await (await getFileStorage()).put(
		file.storageKey,
		file.data,
		file.contentType,
	);
	await db.execute({
		sql: `UPDATE attachments SET name = ?, content_type = ?, size = ?, sha256 = ?, storage_key = ?
          WHERE id = ?`,
		args: [
			file.name,
			file.contentType,
			file.data.length,
			file.sha256,
			file.storageKey,
			attachmentId,
		],
	});
	if (storageKey !== file.storageKey) await removeUnused(db, [storageKey]);
}

/** Removes an attachment; the ones after it move up a number. */
export async function deleteAttachment(
	db: Client,
	userId: string,
	kind: MeetingKind,
	attachmentId: string,
	editSession?: string,
) {
	const { parentId, storageKey } = await requireAttachment(
		db,
		userId,
		kind,
		attachmentId,
		editSession,
	);
	await renumbering(db, kind, parentId, () =>
		db.execute({
			sql: "DELETE FROM attachments WHERE id = ?",
			args: [attachmentId],
		}),
	);
	await removeUnused(db, [storageKey]);
}

/**
 * The statements that give a new protocol its agenda's attachments: the
 * same files, on the protocol's copies of the points (itemIds maps agenda
 * point ids to protocol point ids).
 */
export async function copyAttachmentStatements(
	db: Client,
	itemIds: Map<string, string>,
): Promise<InStatement[]> {
	if (itemIds.size === 0) return [];
	const ids = [...itemIds.keys()];
	const res = await db.execute({
		sql: `SELECT * FROM attachments WHERE item_kind = 'agenda'
          AND item_id IN (${ids.map(() => "?").join(", ")})`,
		args: ids,
	});
	return res.rows.map((r) => ({
		sql: `INSERT INTO attachments (id, item_kind, item_id, position, name, content_type, size, sha256, storage_key, created_at, created_by_name)
          VALUES (?, 'protocol', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			randomUUID(),
			itemIds.get(String(r.item_id)) ?? "",
			r.position,
			r.name,
			r.content_type,
			r.size,
			r.sha256,
			r.storage_key,
			r.created_at,
			r.created_by_name,
		],
	}));
}

/**
 * Removes attachments whose point (or whole agenda or protocol) is gone,
 * and the files nothing points at any more. Call after deleting points.
 */
export async function pruneAttachments(db: Client) {
	// The point and its agenda or protocol must both be there: deleting a
	// whole agenda can't count on the database removing its points.
	const orphans = await db.execute(
		`SELECT id, storage_key FROM attachments a
     WHERE (a.item_kind = 'agenda' AND NOT EXISTS (
             SELECT 1 FROM agenda_items i JOIN agendas p ON p.id = i.agenda_id
             WHERE i.id = a.item_id))
        OR (a.item_kind = 'protocol' AND NOT EXISTS (
             SELECT 1 FROM protocol_items i JOIN protocols p ON p.id = i.protocol_id
             WHERE i.id = a.item_id))`,
	);
	if (orphans.rows.length === 0) return;
	await db.batch(
		orphans.rows.map((r) => ({
			sql: "DELETE FROM attachments WHERE id = ?",
			args: [r.id],
		})),
		"write",
	);
	await removeUnused(
		db,
		orphans.rows.map((r) => String(r.storage_key)),
	);
}

/** Deletes stored files no attachment points at. */
async function removeUnused(db: Client, keys: string[]) {
	const storage = await getFileStorage();
	for (const key of new Set(keys)) {
		const used = await db.execute({
			sql: "SELECT 1 FROM attachments WHERE storage_key = ? LIMIT 1",
			args: [key],
		});
		if (used.rows.length === 0) await storage.remove(key);
	}
}

/** The stored content of an attachment. */
export async function attachmentData(
	db: Client,
	attachmentId: string,
): Promise<Uint8Array | null> {
	const res = await db.execute({
		sql: "SELECT storage_key FROM attachments WHERE id = ?",
		args: [attachmentId],
	});
	const key = res.rows[0]?.storage_key;
	if (typeof key !== "string") return null;
	return (await getFileStorage()).get(key);
}

// ---------- Keeping "Bilaga N" in step with the numbers ----------

/** "Bilaga 3" in a text: the word, a space, the number. */
const REFERENCE = /\bBilaga (\d+)\b/g;

/**
 * Rewrites references after numbers have changed: "Bilaga 3" becomes
 * "Bilaga 2" when 3 became 2. A reference to a removed attachment becomes
 * "Bilaga (borttagen)". All at once, so 2→3 and 3→2 don't collide.
 */
export function renumberText(
	text: string,
	numbers: Map<number, number | null>,
): string {
	return text.replace(REFERENCE, (whole, n: string) => {
		const now = numbers.get(Number(n));
		if (now === undefined) return whole;
		return now === null ? "Bilaga (borttagen)" : `Bilaga ${now}`;
	});
}

/**
 * Runs a change that may change the meeting's attachment numbers (adding,
 * removing, moving or deleting points), then rewrites "Bilaga N" in the
 * meeting's texts to match: descriptions, and on protocols the notes and
 * decisions recorded.
 */
export async function renumbering<T>(
	db: Client,
	kind: MeetingKind,
	parentId: string,
	change: () => Promise<T>,
): Promise<T> {
	const before = await listAttachments(db, kind, parentId);
	const result = await change();
	const after = new Map(
		(await listAttachments(db, kind, parentId)).map((a) => [a.id, a.number]),
	);
	const numbers = new Map<number, number | null>();
	for (const a of before) {
		const now = after.get(a.id) ?? null;
		if (now !== a.number) numbers.set(a.number, now);
	}
	if (numbers.size > 0) await rewriteTexts(db, kind, parentId, numbers);
	return result;
}

async function rewriteTexts(
	db: Client,
	kind: MeetingKind,
	parentId: string,
	numbers: Map<number, number | null>,
) {
	const t = TABLE[kind];
	const res = await db.execute({
		sql: `SELECT id, description${kind === "protocol" ? ", value" : ""} FROM ${t.items} WHERE ${t.fk} = ?`,
		args: [parentId],
	});
	const statements: InStatement[] = [];
	for (const row of res.rows) {
		const description = String(row.description);
		const newDescription = renumberText(description, numbers);
		if (newDescription !== description)
			statements.push({
				sql: `UPDATE ${t.items} SET description = ? WHERE id = ?`,
				args: [newDescription, row.id],
			});
		if (kind !== "protocol" || typeof row.value !== "string") continue;
		let value: Record<string, unknown>;
		try {
			value = JSON.parse(row.value);
		} catch {
			continue;
		}
		let changed = false;
		for (const field of ["notes", "decision"]) {
			const text = value[field];
			if (typeof text !== "string") continue;
			const next = renumberText(text, numbers);
			if (next !== text) {
				value[field] = next;
				changed = true;
			}
		}
		if (changed)
			statements.push({
				sql: "UPDATE protocol_items SET value = ? WHERE id = ?",
				args: [JSON.stringify(value), row.id],
			});
	}
	if (statements.length > 0) await db.batch(statements, "write");
}

// ---------- Reading attachments: who may, and the response ----------

/** An attachment as a file to send: its name, type and content. */
export type AttachmentFile = {
	name: string;
	contentType: AttachmentType;
	data: Uint8Array;
};

async function fileFor(
	db: Client,
	attachmentId: string,
	allowed: (row: {
		kind: string;
		parentId: string;
		boardId: string;
	}) => boolean | Promise<boolean>,
): Promise<AttachmentFile | null> {
	const res = await db.execute({
		sql: `SELECT a.name, a.content_type, a.item_kind,
                 COALESCE(ai.agenda_id, pi.protocol_id) AS parent_id,
                 COALESCE(ag.board_id, pr.board_id) AS board_id
          FROM attachments a
          LEFT JOIN agenda_items ai ON a.item_kind = 'agenda' AND ai.id = a.item_id
          LEFT JOIN agendas ag ON ag.id = ai.agenda_id
          LEFT JOIN protocol_items pi ON a.item_kind = 'protocol' AND pi.id = a.item_id
          LEFT JOIN protocols pr ON pr.id = pi.protocol_id
          WHERE a.id = ?`,
		args: [attachmentId],
	});
	const row = res.rows[0];
	if (!row || row.parent_id == null || row.board_id == null) return null;
	const ok = await allowed({
		kind: String(row.item_kind),
		parentId: String(row.parent_id),
		boardId: String(row.board_id),
	});
	if (!ok) return null;
	const data = await attachmentData(db, attachmentId);
	return data
		? {
				name: String(row.name),
				contentType: String(row.content_type) as AttachmentType,
				data,
			}
		: null;
}

/** For a member of the board the meeting belongs to. */
export async function attachmentForMember(
	db: Client,
	userId: string,
	attachmentId: string,
) {
	return fileFor(db, attachmentId, async ({ boardId }) => {
		const res = await db.execute({
			sql: "SELECT 1 FROM board_memberships WHERE board_id = ? AND user_id = ?",
			args: [boardId, userId],
		});
		return res.rows.length > 0;
	});
}

/** Through an agenda's share link: that agenda's attachments. */
export async function attachmentForAgendaShare(
	db: Client,
	shareId: string,
	attachmentId: string,
) {
	if (!shareId) return null;
	return fileFor(db, attachmentId, async ({ kind, parentId }) => {
		if (kind !== "agenda") return false;
		const res = await db.execute({
			sql: "SELECT 1 FROM agendas WHERE id = ? AND share_id = ?",
			args: [parentId, shareId],
		});
		return res.rows.length > 0;
	});
}

/** Through a protocol's share link, once the protocol is closed. */
export async function attachmentForProtocolShare(
	db: Client,
	shareId: string,
	attachmentId: string,
) {
	if (!shareId) return null;
	return fileFor(db, attachmentId, async ({ kind, parentId }) => {
		if (kind !== "protocol") return false;
		const res = await db.execute({
			sql: "SELECT 1 FROM protocols WHERE id = ? AND share_id = ? AND closed_at IS NOT NULL",
			args: [parentId, shareId],
		});
		return res.rows.length > 0;
	});
}

/** For a justerare, through their link: the protocol they were sent. */
export async function attachmentForProtocol(
	db: Client,
	protocolId: string,
	attachmentId: string,
) {
	return fileFor(
		db,
		attachmentId,
		({ kind, parentId }) => kind === "protocol" && parentId === protocolId,
	);
}

/**
 * The response for an attachment: shown in the browser (in the app's
 * dialog, which frames it), or saved with ?ladda-ner. Never cached by the
 * CDN, since who may read it is checked on every request. Only the app's
 * own pages may frame it; the file itself may run nothing.
 */
export function attachmentResponse(file: AttachmentFile, download: boolean) {
	const ascii = file.name.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
	return new Response(new Uint8Array(file.data), {
		headers: {
			"Content-Type": file.contentType,
			"Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
			"Cache-Control": "private, no-store",
			"Content-Security-Policy":
				"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'self'",
			"X-Frame-Options": "SAMEORIGIN",
			"X-Robots-Tag": "noindex",
			"Referrer-Policy": "no-referrer",
		},
	});
}

export const attachmentNotFound = () =>
	new Response("Bilagan finns inte.", { status: 404 });
