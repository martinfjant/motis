import type { Client } from "@libsql/client";
import { attachmentData } from "../files/attachments.server";
import { appendAttachments } from "./append.server";
import { fileName, type ProtocolDocument } from "./document.server";
import { attachmentPath, protocolMarkdown } from "./markdown.server";
import { protocolPdf } from "./pdf.server";

export type DownloadFormat = "pdf" | "md";

export const isDownloadFormat = (v: string): v is DownloadFormat =>
	v === "pdf" || v === "md";

/**
 * Whether a download includes the attachments: yes, unless the address says
 * ?bilagor=nej (offered for meetings with many or large attachments).
 */
export const wantsAttachments = (request: Request) =>
	new URL(request.url).searchParams.get("bilagor") !== "nej";

/**
 * The protocol as a file to save, named after the meeting. With its
 * attachments: a PDF has them appended; Markdown comes as a zip with the
 * protocol and the files.
 */
export async function downloadResponse(
	db: Client,
	doc: ProtocolDocument,
	format: DownloadFormat,
	withAttachments: boolean,
): Promise<Response> {
	const attach = withAttachments && doc.attachments.length > 0;
	const read = (a: { id: string }) => attachmentData(db, a.id);
	if (format === "pdf") {
		const pdf = new Uint8Array(await protocolPdf(doc, attach));
		const body = attach
			? await appendAttachments(pdf, doc.attachments, read)
			: pdf;
		return fileResponse(body, fileName(doc, "pdf"), "application/pdf");
	}
	const markdown = protocolMarkdown(doc, attach);
	if (!attach)
		return fileResponse(
			markdown,
			fileName(doc, "md"),
			"text/markdown; charset=utf-8",
		);
	const { zipSync, strToU8 } = await import("fflate");
	const files: Record<string, Uint8Array> = {
		[fileName(doc, "md")]: strToU8(markdown),
	};
	for (const a of doc.attachments) {
		const data = await read(a);
		if (data) files[attachmentPath(a)] = data;
	}
	// PDFs and pictures are compressed already: stored as they are.
	return fileResponse(
		zipSync(files, { level: 0 }),
		fileName(doc, "zip"),
		"application/zip",
	);
}

function fileResponse(
	body: Uint8Array | string,
	name: string,
	contentType: string,
) {
	// The plain name for old clients, the exact one (with å, ä, ö) for the rest.
	const ascii = name.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
	return new Response(typeof body === "string" ? body : new Uint8Array(body), {
		headers: {
			"Content-Type": contentType,
			"Content-Disposition": `attachment; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
			"Cache-Control": "private, no-store",
			"X-Robots-Tag": "noindex",
			"Referrer-Policy": "no-referrer",
		},
	});
}

export const notFound = () => new Response("Hittades inte.", { status: 404 });
