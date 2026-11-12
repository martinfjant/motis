import { createFileRoute } from "@tanstack/react-router";

// Anyone with the share link downloads the closed protocol:
// /api/delat-protokoll/<shareId>/pdf or …/md. Nothing until it is closed.
export const Route = createFileRoute("/api/delat-protokoll/$shareId/$format")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { downloadResponse, isDownloadFormat, notFound } = await import(
					"#/server/export/download.server"
				);
				if (!isDownloadFormat(params.format)) return notFound();
				const { getDb } = await import("#/server/db");
				const { documentForShare } = await import(
					"#/server/export/document.server"
				);
				const { BoardError } = await import("#/server/boards.server");
				try {
					const doc = await documentForShare(await getDb(), params.shareId);
					return doc ? downloadResponse(doc, params.format) : notFound();
				} catch (err) {
					if (err instanceof BoardError) return notFound();
					throw err;
				}
			},
		},
	},
});
