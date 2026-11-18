import { createServerFn } from "@tanstack/react-start";

export const searchProtocols = createServerFn({ method: "GET" })
	.validator((d: unknown) => {
		const q = (d as { q?: unknown } | null)?.q;
		return { q: typeof q === "string" ? q.slice(0, 200) : "" };
	})
	.handler(async ({ data }) => {
		const { requireUser } = await import("./session.server");
		const { searchProtocols } = await import("./search.server");
		const { db, user } = await requireUser();
		return searchProtocols(db, user.id, data.q);
	});
