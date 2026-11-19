import { createClient } from "@libsql/client";
import sharp from "sharp";
import { beforeEach, expect, test } from "vitest";
import { createUser } from "../auth.server";
import {
	addMemberByEmail,
	BoardError,
	createBoard,
	getBoard,
} from "../boards.server";
import { migrate } from "../migrate";
import {
	pdfLogo,
	removeBoardImage,
	setBoardImage,
} from "./board-images.server";
import { getFileStorage } from "./storage.server";

let db: ReturnType<typeof createClient>;
let anna: string;
let bo: string;
let boardId: string;

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
	boardId = (await createBoard(db, anna, "BRF Björken")).id;
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
});

/** A photo as a phone would send it: large, with a GPS position. */
async function photo(width = 4000, height = 3000) {
	return new Uint8Array(
		await sharp({
			create: { width, height, channels: 3, background: "#4a7" },
		})
			.jpeg()
			.withExif({
				IFD0: { Make: "Telefon", Model: "X" },
				IFD3: { GPSLatitudeRef: "N", GPSLatitude: "59/1 20/1 0/1" },
			})
			.toBuffer(),
	);
}

const keyOf = (url: string | null) =>
	`bilder/${String(url).split("/").at(-1)}.webp`;

async function stored(url: string | null) {
	const m = /^\/api\/bilder\/webp\/([0-9a-f]{64})$/.exec(String(url));
	expect(m).not.toBeNull();
	const key = `bilder/${m?.[1]}.webp`;
	const data = await (await getFileStorage()).get(key);
	if (!data) throw new Error(`${key} saknas`);
	return data;
}

test("a banner is made smaller, as WebP, without the photo's metadata", async () => {
	const original = await photo();
	expect((await sharp(original).metadata()).exif).toBeDefined();
	await setBoardImage(db, anna, boardId, "banner", original);
	const board = await getBoard(db, anna, boardId);
	const meta = await sharp(await stored(board?.banner ?? null)).metadata();
	expect(meta.format).toBe("webp");
	expect(meta.width).toBe(1600);
	expect(meta.exif).toBeUndefined();
});

test("a logo is kept for pages and for the PDF; replacing it removes the old files", async () => {
	await setBoardImage(db, anna, boardId, "logo", await photo(800, 800));
	const first = (await getBoard(db, anna, boardId))?.logo ?? null;
	const firstFile = await stored(first);
	expect((await sharp(firstFile).metadata()).width).toBe(512);
	const pdf = await pdfLogo(db, boardId);
	expect(pdf && (await sharp(pdf).metadata()).format).toBe("png");

	await setBoardImage(db, anna, boardId, "logo", await photo(600, 300));
	const second = (await getBoard(db, anna, boardId))?.logo ?? null;
	expect(second).not.toBe(first);
	const storage = await getFileStorage();
	expect(await storage.get(keyOf(first))).toBeNull();

	await removeBoardImage(db, anna, boardId, "logo");
	expect((await getBoard(db, anna, boardId))?.logo).toBeNull();
	expect(await storage.get(keyOf(second))).toBeNull();
	expect(await pdfLogo(db, boardId)).toBeNull();
});

test("only admins change the pictures, and only pictures are accepted", async () => {
	await expect(
		setBoardImage(db, bo, boardId, "logo", await photo(100, 100)),
	).rejects.toThrow(BoardError);
	await expect(
		setBoardImage(
			db,
			anna,
			boardId,
			"logo",
			new TextEncoder().encode("<svg onload=alert(1)>"),
		),
	).rejects.toThrow("JPEG-, PNG- eller WebP-bild");
});
