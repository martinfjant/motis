import { createFileRoute } from "@tanstack/react-router";

// A board member reads an attachment of their board's agenda or protocol:
// /api/bilagor/<id>, or with ?ladda-ner to save it.
export const Route = createFileRoute("/api/bilagor/$attachmentId")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const files = await import("#/server/files/attachments.server");
				const { getSessionUser } = await import("#/server/auth.server");
				const { getCookie } = await import("@tanstack/react-start/server");
				const { SESSION_COOKIE } = await import("#/server/session.server");
				const { getDb } = await import("#/server/db");
				const db = await getDb();
				const user = await getSessionUser(db, getCookie(SESSION_COOKIE));
				if (!user) return files.attachmentNotFound();
				const file = await files.attachmentForMember(
					db,
					user.id,
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
