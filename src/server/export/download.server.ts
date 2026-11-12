import { fileName, type ProtocolDocument } from "./document.server";
import { protocolMarkdown } from "./markdown.server";
import { protocolPdf } from "./pdf.server";

export type DownloadFormat = "pdf" | "md";

export const isDownloadFormat = (v: string): v is DownloadFormat =>
	v === "pdf" || v === "md";

/** The protocol as a file to save, named after the meeting. */
export async function downloadResponse(
	doc: ProtocolDocument,
	format: DownloadFormat,
): Promise<Response> {
	const name = fileName(doc, format);
	const body =
		format === "pdf"
			? new Uint8Array(await protocolPdf(doc))
			: protocolMarkdown(doc);
	// The plain name for old clients, the exact one (with å, ä, ö) for the rest.
	const ascii = name.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
	return new Response(body, {
		headers: {
			"Content-Type":
				format === "pdf" ? "application/pdf" : "text/markdown; charset=utf-8",
			"Content-Disposition": `attachment; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
			"Cache-Control": "private, no-store",
			"X-Robots-Tag": "noindex",
			"Referrer-Policy": "no-referrer",
		},
	});
}

export const notFound = () => new Response("Hittades inte.", { status: 404 });
