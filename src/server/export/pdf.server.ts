import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatInstant } from "../../meeting-time";
import {
	type Block,
	historyLines,
	meetingLines,
	type ProtocolDocument,
} from "./document.server";

// The protocol as a PDF, made with pdfmake on the server. pdfmake reads its
// fonts (Roboto, which has å, ä and ö) from its own package folder, so it is
// kept out of the bundle (see vite.config.ts) and only allowed to read
// there; it never fetches anything from the network.

const require = createRequire(import.meta.url);

type Pdfmake = typeof import("pdfmake");
let pdfmake: Pdfmake | undefined;

function loadPdfmake(): Pdfmake {
	if (pdfmake) return pdfmake;
	const lib = require("pdfmake") as Pdfmake;
	const fonts = require("pdfmake/fonts/Roboto") as {
		Roboto: { normal: string };
	};
	const fontDir = dirname(fonts.Roboto.normal);
	lib.addFonts(fonts);
	lib.setUrlAccessPolicy(() => false);
	lib.setLocalAccessPolicy((path) => path.startsWith(fontDir));
	pdfmake = lib;
	return lib;
}

const GREY = "#57534e";

function paragraphs(text: string): Content[] {
	return text
		.split(/\n{2,}/)
		.filter((p) => p.trim())
		.map((p) => ({ text: p.trim(), margin: [0, 0, 0, 4] }));
}

function block(b: Block): Content[] {
	switch (b.kind) {
		case "text":
			return paragraphs(b.text);
		case "value":
			return [
				{
					text: [`${b.label}: `, { text: b.value, bold: true }],
					margin: [0, 0, 0, 4],
				},
			];
		case "list":
			return [
				{ text: b.label, margin: [0, 0, 0, 2] },
				{ ul: b.items, margin: [8, 0, 0, 4] },
			];
		case "quote":
			return [
				{ text: b.label, margin: [0, 0, 0, 2] },
				{
					stack: paragraphs(b.text),
					margin: [12, 0, 0, 4],
					italics: true,
				},
			];
	}
}

function definition(doc: ProtocolDocument): TDocumentDefinitions {
	const content: Content[] = [
		{ text: doc.boardName, color: GREY, margin: [0, 0, 0, 4] },
		{ text: `Protokoll: ${doc.title}`, style: "h1" },
	];
	const details = meetingLines(doc);
	if (details.length)
		content.push({
			table: {
				body: details.map((d) => [{ text: d.label, color: GREY }, d.value]),
			},
			layout: "noBorders",
			margin: [0, 0, 0, 8],
		});

	doc.points.forEach((point, i) => {
		content.push({
			// A point's heading stays with what follows it.
			stack: [
				{ text: `${i + 1}. ${point.title}`, style: "h2" },
				...(point.description.trim()
					? [{ stack: paragraphs(point.description), color: GREY }]
					: []),
				...point.blocks.flatMap(block),
			],
			unbreakable: point.blocks.length < 6,
		});
	});

	content.push(
		{ text: "Historik", style: "h2" },
		{ ul: historyLines(doc), color: GREY },
	);

	if (doc.justering)
		content.push({
			stack: [
				{ text: "Justering", style: "h2" },
				{ text: "Protokollet är justerat av:", margin: [0, 0, 0, 8] },
				{
					columns: doc.justering.reviewers.map((r) => ({
						width: 200,
						stack: [
							r.signature
								? { image: r.signature, fit: [180, 60] }
								: { text: " ", margin: [0, 0, 0, 40] },
							{
								canvas: [
									{
										type: "line",
										x1: 0,
										y1: 2,
										x2: 180,
										y2: 2,
										lineWidth: 0.5,
										lineColor: GREY,
									},
								],
							},
							{ text: r.name, margin: [0, 4, 0, 0] },
							{
								text: `${r.signature ? "Signerat digitalt" : "Godkänt"} ${formatInstant(r.approvedAt)}`,
								color: GREY,
								fontSize: 9,
							},
						],
					})),
					columnGap: 24,
				},
			],
			unbreakable: true,
		});

	return {
		info: { title: `Protokoll: ${doc.title}`, subject: doc.boardName },
		pageSize: "A4",
		pageMargins: [56, 56, 56, 64],
		defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.25 },
		styles: {
			h1: { fontSize: 20, bold: true, margin: [0, 0, 0, 12] },
			h2: { fontSize: 13, bold: true, margin: [0, 14, 0, 4] },
		},
		footer: (page, pages) => ({
			text: `${doc.boardName} · Protokoll: ${doc.title} · Sida ${page} av ${pages}`,
			alignment: "center",
			fontSize: 8,
			color: GREY,
			margin: [56, 24, 56, 0],
		}),
		content,
	};
}

export async function protocolPdf(doc: ProtocolDocument): Promise<Buffer> {
	return loadPdfmake().createPdf(definition(doc)).getBuffer();
}
