import { createFileRoute } from "@tanstack/react-router";
import { configProblems } from "#/server/config.server";
import { getDb } from "#/server/db";

/**
 * For the host's health check: 200 {"ok":true} when the settings are in
 * place and the database answers (with migrations applied), otherwise 503
 * with what is wrong. Says nothing about the data.
 */
export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () => {
				const problems = configProblems();
				if (problems.length > 0)
					return Response.json({ ok: false, problems }, { status: 503 });
				try {
					const db = await getDb();
					await db.execute("SELECT 1");
					return Response.json({ ok: true });
				} catch (err) {
					console.error("Health check: database unavailable", err);
					return Response.json(
						{ ok: false, problems: ["Databasen svarar inte."] },
						{ status: 503 },
					);
				}
			},
		},
	},
});
