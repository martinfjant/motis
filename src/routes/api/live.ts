import { createFileRoute } from "@tanstack/react-router";

/**
 * For the host's liveness check: 200 as long as the server answers at all.
 * Deliberately touches nothing else (unlike /api/health, which also asks
 * the database): restarting the app can't fix a database that is down, so
 * a database problem mustn't get the app restarted over and over.
 */
export const Route = createFileRoute("/api/live")({
	server: {
		handlers: {
			GET: () =>
				new Response("ok", {
					headers: {
						"Content-Type": "text/plain; charset=utf-8",
						"Cache-Control": "no-store",
					},
				}),
		},
	},
});
