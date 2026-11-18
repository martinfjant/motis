import { createFileRoute } from "@tanstack/react-router";

// Anyone with the share link downloads the closed protocol:
// /api/delat-protokoll/<shareId>/pdf or …/md. Nothing until it is closed.
export const Route = createFileRoute("/api/delat-protokoll/$shareId/$format")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const {
					downloadResponse,
					isDownloadFormat,
					notFound,
					wantsAttachments,
				} = await import("#/server/export/download.server");
				if (!isDownloadFormat(params.format)) return notFound();
				const { getDb } = await import("#/server/db");
				const { documentForShare } = await import(
					"#/server/export/document.server"
				);
				const { BoardError } = await import("#/server/boards.server");
				try {
					const db = await getDb();
					const doc = await documentForShare(db, params.shareId);
					return doc
						? downloadResponse(
								db,
								doc,
								params.format,
								wantsAttachments(request),
							)
						: notFound();
				} catch (err) {
					if (err instanceof BoardError) return notFound();
					throw err;
				}
			},
		},
	},
});
