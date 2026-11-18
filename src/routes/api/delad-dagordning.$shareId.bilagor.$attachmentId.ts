import { createFileRoute } from "@tanstack/react-router";

// Anyone with an agenda's share link reads its attachments:
// /api/delad-dagordning/<shareId>/bilagor/<id> (?ladda-ner to save).
export const Route = createFileRoute(
	"/api/delad-dagordning/$shareId/bilagor/$attachmentId",
)({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const files = await import("#/server/files/attachments.server");
				const { getDb } = await import("#/server/db");
				const file = await files.attachmentForAgendaShare(
					await getDb(),
					params.shareId,
					params.attachmentId,
				);
				return file
					? files.attachmentResponse(
							file,
							new URL(request.url).searchParams.has("ladda-ner"),
						)
					: files.attachmentNotFound();
			},
		},
	},
});
