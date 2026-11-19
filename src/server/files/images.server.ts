import type { Sharp } from "sharp";
import { BoardError } from "../boards.server";

// Uploaded pictures are always made anew with sharp, never stored as sent:
// at a sensible size, in a compact format, and without metadata (photos
// from phones often hold the GPS position where they were taken, for a
// picture of the houses that's the address) or anything else hidden in the
// file.

/** At most this many pixels in (against huge or crafted images). */
const MAX_INPUT_PIXELS = 50_000_000;

async function open(data: Uint8Array): Promise<Sharp> {
	const { default: sharp } = await import("sharp");
	const image = sharp(data, { limitInputPixels: MAX_INPUT_PIXELS });
	try {
		const meta = await image.metadata();
		if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format))
			throw new Error(meta.format);
	} catch {
		throw new BoardError("Bilden måste vara en JPEG-, PNG- eller WebP-bild.");
	}
	// Turned the way the camera says, before that information is dropped.
	return image.rotate();
}

/** A board's logo: for pages (WebP) and for the PDF (PNG, which it reads). */
export async function logoImages(data: Uint8Array) {
	const image = await open(data);
	const fit = { fit: "inside", withoutEnlargement: true } as const;
	const [web, pdf] = await Promise.all([
		image.clone().resize(512, 512, fit).webp({ quality: 88 }).toBuffer(),
		image.clone().resize(400, 400, fit).png().toBuffer(),
	]);
	return { web: new Uint8Array(web), pdf: new Uint8Array(pdf) };
}

/** A board's banner, shown wide behind the page heading. */
export async function bannerImage(data: Uint8Array) {
	const image = await open(data);
	const web = await image
		.resize(2400, 1200, { fit: "inside", withoutEnlargement: true })
		.webp({ quality: 80 })
		.toBuffer();
	return new Uint8Array(web);
}

/**
 * A picture attached to a point. Kept as JPEG or PNG, which the PDF can
 * append (WebP becomes JPEG), at most 3000 pixels on its longest side.
 */
export async function attachmentImage(
	data: Uint8Array,
): Promise<{ data: Uint8Array; contentType: "image/jpeg" | "image/png" }> {
	const image = await open(data);
	const { format } = await image.metadata();
	const sized = image.resize(3000, 3000, {
		fit: "inside",
		withoutEnlargement: true,
	});
	if (format === "png")
		return {
			data: new Uint8Array(await sized.png().toBuffer()),
			contentType: "image/png",
		};
	return {
		data: new Uint8Array(await sized.jpeg({ quality: 88 }).toBuffer()),
		contentType: "image/jpeg",
	};
}
