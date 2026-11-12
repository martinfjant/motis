import { createFileRoute } from "@tanstack/react-router";

// A board member downloads their board's closed protocol:
// /api/protokoll/<id>/pdf or /api/protokoll/<id>/md.
export const Route = createFileRoute("/api/protokoll/$protocolId/$format")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { downloadResponse, isDownloadFormat, notFound } = await import(
					"#/server/export/download.server"
				);
				if (!isDownloadFormat(params.format)) return notFound();
				const { getSessionUser } = await import("#/server/auth.server");
				const { getCookie } = await import("@tanstack/react-start/server");
				const { SESSION_COOKIE } = await import("#/server/session.server");
				const { getDb } = await import("#/server/db");
				const db = await getDb();
				const user = await getSessionUser(db, getCookie(SESSION_COOKIE));
				if (!user)
					return new Response("Logga in för att ladda ner protokollet.", {
						status: 401,
					});
				const { documentForMember } = await import(
					"#/server/export/document.server"
				);
				const { BoardError } = await import("#/server/boards.server");
				try {
					const doc = await documentForMember(db, user.id, params.protocolId);
					return downloadResponse(doc, params.format);
				} catch (err) {
					if (err instanceof BoardError)
						return new Response(err.message, { status: 404 });
					throw err;
				}
			},
		},
	},
});
