import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "#/server/db";

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () => {
				const db = await getDb();
				const r = await db.execute("SELECT COUNT(*) AS n FROM users");
				return Response.json({ ok: true, users: Number(r.rows[0].n) });
			},
		},
	},
});
