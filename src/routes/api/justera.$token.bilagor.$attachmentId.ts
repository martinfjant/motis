import { createFileRoute } from "@tanstack/react-router";

// A justerare reads the attachments of the protocol they were sent, through
// their link: /api/justera/<token>/bilagor/<id> (?ladda-ner to save).
export const Route = createFileRoute(
	"/api/justera/$token/bilagor/$attachmentId",
)({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const files = await import("#/server/files/attachments.server");
				const { protocolForReviewToken } = await import(
					"#/server/reviews.server"
				);
				const { getDb } = await import("#/server/db");
				const db = await getDb();
				const protocolId = await protocolForReviewToken(db, params.token);
				const file =
					protocolId &&
					(await files.attachmentForProtocol(
						db,
						protocolId,
						params.attachmentId,
					));
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
