import type { PDFFont, PDFPage } from "pdf-lib";
import { attachmentLabel, type DocumentAttachment } from "./document.server";

// Appends a protocol's attachments to its PDF, in number order: a PDF's
// pages as they are, with "Bilaga N: name" in small print at the top of its
// first page; a picture on a page of its own under the same line.

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const GREY = { red: 0.34, green: 0.33, blue: 0.31 } as const;

/**
 * The standard PDF fonts only know Western European letters (å, ä and ö
 * among them); anything else in a file name becomes "?".
 */
function printable(text: string) {
	return text.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

export async function appendAttachments(
	protocol: Uint8Array,
	attachments: DocumentAttachment[],
	read: (attachment: DocumentAttachment) => Promise<Uint8Array | null>,
): Promise<Uint8Array> {
	if (attachments.length === 0) return protocol;
	const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
	const out = await PDFDocument.load(protocol);
	const font = await out.embedFont(StandardFonts.Helvetica);
	const grey = rgb(GREY.red, GREY.green, GREY.blue);

	/** "Bilaga N: name" at the top of a page, on white so it can be read. */
	function label(page: PDFPage, text: string, f: PDFFont) {
		const size = 8;
		const line = printable(text);
		const width = f.widthOfTextAtSize(line, size);
		const { height } = page.getSize();
		page.drawRectangle({
			x: 14,
			y: height - 24,
			width: width + 8,
			height: size + 6,
			color: rgb(1, 1, 1),
			opacity: 0.85,
		});
		page.drawText(line, { x: 18, y: height - 20, size, font: f, color: grey });
	}

	/** A page saying an attachment couldn't be added, so it isn't missed. */
	function missing(a: DocumentAttachment) {
		const page = out.addPage(A4);
		page.drawText(printable(attachmentLabel(a)), {
			x: MARGIN,
			y: A4[1] - MARGIN - 14,
			size: 14,
			font,
		});
		page.drawText(
			"Bilagan kunde inte läggas till i den här PDF:en. Hämta den som egen fil.",
			{ x: MARGIN, y: A4[1] - MARGIN - 40, size: 10, font, color: grey },
		);
	}

	for (const a of attachments) {
		const data = await read(a);
		if (!data) {
			missing(a);
			continue;
		}
		try {
			if (a.contentType === "application/pdf") {
				const source = await PDFDocument.load(data, {
					ignoreEncryption: true,
				});
				const pages = await out.copyPages(source, source.getPageIndices());
				pages.forEach((page, i) => {
					out.addPage(page);
					if (i === 0 && page.getRotation().angle === 0)
						label(page, attachmentLabel(a), font);
				});
			} else {
				const image =
					a.contentType === "image/png"
						? await out.embedPng(data)
						: await out.embedJpg(data);
				const page = out.addPage(A4);
				page.drawText(printable(attachmentLabel(a)), {
					x: MARGIN,
					y: A4[1] - MARGIN - 12,
					size: 12,
					font,
				});
				const room = {
					width: A4[0] - 2 * MARGIN,
					height: A4[1] - 2 * MARGIN - 28,
				};
				const scaled = image.scaleToFit(room.width, room.height);
				page.drawImage(image, {
					x: (A4[0] - scaled.width) / 2,
					y: A4[1] - MARGIN - 28 - scaled.height,
					width: scaled.width,
					height: scaled.height,
				});
			}
		} catch (err) {
			console.error(`Kunde inte lägga till ${attachmentLabel(a)}:`, err);
			missing(a);
		}
	}
	return out.save();
}
