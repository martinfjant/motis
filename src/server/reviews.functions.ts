import { createServerFn } from "@tanstack/react-start";

// Justering. Sending needs a board member; the justerare's page and answer
// only need the personal link (justerare may have no account).

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (d: unknown) => (d ?? {}) as Record<string, unknown>;

export const sendForReview = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ protocolId: str(obj(d).protocolId) }))
	.handler(async ({ data }) => {
		const { requireUser } = await import("./session.server");
		const { db, user } = await requireUser();
		const { sendForReview } = await import("./reviews.server");
		await sendForReview(db, user.id, data.protocolId);
	});

export const getReviewPage = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ token: str(obj(d).token) }))
	.handler(async ({ data }) => {
		const { getDb } = await import("./db");
		const { getReviewPage } = await import("./reviews.server");
		return getReviewPage(await getDb(), data.token);
	});

export const decideReview = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		token: str(obj(d).token),
		approve: obj(d).approve === true,
		comment: str(obj(d).comment),
		signature: str(obj(d).signature),
	}))
	.handler(async ({ data }) => {
		const { getDb } = await import("./db");
		const { decideReview } = await import("./reviews.server");
		await decideReview(await getDb(), data.token, data);
	});
