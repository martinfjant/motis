import { createHash } from "node:crypto";
import type { Client } from "@libsql/client";
import { requireAdmin } from "../boards.server";
import { bannerImage, logoImages } from "./images.server";
import { getFileStorage } from "./storage.server";

// A board's logo and banner picture, chosen by its admins. Stored under
// "bilder/<sha256 of the file>.<format>": a new picture gets a new name, so
// the old one can be cached for good (see the api/bilder route).

/** The most a picture may weigh when uploaded (before it is made smaller). */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type BoardImage = "logo" | "banner";

function imageKey(data: Uint8Array, extension: string) {
	const hash = createHash("sha256").update(data).digest("hex");
	return `bilder/${hash}.${extension}`;
}

/** Saves a new logo or banner for the board, replacing any earlier one. */
export async function setBoardImage(
	db: Client,
	actorId: string,
	boardId: string,
	which: BoardImage,
	upload: Uint8Array,
) {
	await requireAdmin(db, actorId, boardId);
	const storage = await getFileStorage();
	if (which === "logo") {
		const { web, pdf } = await logoImages(upload);
		const webKey = imageKey(web, "webp");
		const pdfKey = imageKey(pdf, "png");
		await storage.put(webKey, web, "image/webp");
		await storage.put(pdfKey, pdf, "image/png");
		await replaceKeys(db, boardId, {
			logo_key: webKey,
			logo_pdf_key: pdfKey,
		});
	} else {
		const banner = await bannerImage(upload);
		const key = imageKey(banner, "webp");
		await storage.put(key, banner, "image/webp");
		await replaceKeys(db, boardId, { banner_key: key });
	}
}

/** Removes the board's logo or banner. */
export async function removeBoardImage(
	db: Client,
	actorId: string,
	boardId: string,
	which: BoardImage,
) {
	await requireAdmin(db, actorId, boardId);
	await replaceKeys(
		db,
		boardId,
		which === "logo"
			? { logo_key: null, logo_pdf_key: null }
			: { banner_key: null },
	);
}

const COLUMNS = ["logo_key", "logo_pdf_key", "banner_key"] as const;
type Column = (typeof COLUMNS)[number];

/**
 * Points the board at new files, then deletes the files it pointed at before
 * unless another board uses the same picture.
 */
async function replaceKeys(
	db: Client,
	boardId: string,
	keys: Partial<Record<Column, string | null>>,
) {
	const columns = Object.keys(keys) as Column[];
	const before = await db.execute({
		sql: `SELECT ${columns.join(", ")} FROM boards WHERE id = ?`,
		args: [boardId],
	});
	await db.execute({
		sql: `UPDATE boards SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
		args: [...columns.map((c) => keys[c] ?? null), boardId],
	});
	const old = columns
		.map((c) => before.rows[0]?.[c])
		.filter((k): k is string => typeof k === "string")
		.filter((k) => !Object.values(keys).includes(k));
	await removeUnused(db, old);
}

/** Deletes stored pictures no board points at any more. */
export async function removeUnused(db: Client, keys: string[]) {
	if (keys.length === 0) return;
	const storage = await getFileStorage();
	for (const key of keys) {
		const used = await db.execute({
			sql: `SELECT 1 FROM boards
            WHERE logo_key = ?1 OR logo_pdf_key = ?1 OR banner_key = ?1 LIMIT 1`,
			args: [key],
		});
		if (used.rows.length === 0) await storage.remove(key);
	}
}

/** The board's logo for the PDF (PNG), if it has one. */
export async function pdfLogo(
	db: Client,
	boardId: string,
): Promise<Uint8Array | null> {
	const res = await db.execute({
		sql: "SELECT logo_pdf_key FROM boards WHERE id = ?",
		args: [boardId],
	});
	const key = res.rows[0]?.logo_pdf_key;
	if (typeof key !== "string") return null;
	return (await getFileStorage()).get(key);
}
