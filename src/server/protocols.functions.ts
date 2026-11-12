import { createServerFn } from "@tanstack/react-start";
import type { MemberRef } from "./items";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (d: unknown) => (d ?? {}) as Record<string, unknown>;

async function ctx() {
	const { requireUser } = await import("./session.server");
	const protocols = await import("./protocols.server");
	return { ...(await requireUser()), protocols };
}

export const getBoardProtocols = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ boardId: str(obj(d).boardId) }))
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		return protocols.listProtocols(db, user.id, data.boardId);
	});

export const createProtocol = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ agendaId: str(obj(d).agendaId) }))
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		return protocols.createProtocol(db, user.id, data.agendaId);
	});

export const getProtocol = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ protocolId: str(obj(d).protocolId) }))
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		const { BoardError } = await import("./boards.server");
		const { getJustering, getReviewRound } = await import("./reviews.server");
		try {
			const protocol = await protocols.getProtocol(
				db,
				user.id,
				data.protocolId,
			);
			/** The latest sending for justering, or null. */
			const review = await getReviewRound(db, data.protocolId);
			/** Who justerade it, with signatures, once justerat. */
			const justering = await getJustering(db, data.protocolId);
			return { ...protocol, review, justering };
		} catch (err) {
			if (err instanceof BoardError) return null;
			throw err;
		}
	});

export const updateProtocol = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		protocolId: str(obj(d).protocolId),
		editSession: str(obj(d).editSession) || undefined,
		title: str(obj(d).title),
		meetingAt: str(obj(d).meetingAt),
		location: str(obj(d).location),
	}))
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		await protocols.updateProtocol(
			db,
			user.id,
			data.protocolId,
			data,
			data.editSession,
		);
	});

export const deleteProtocol = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ protocolId: str(obj(d).protocolId) }))
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		await protocols.deleteProtocol(db, user.id, data.protocolId);
	});

export const saveItemValue = createServerFn({ method: "POST" })
	.validator((d: unknown) => {
		const v = obj(obj(d).value);
		return {
			itemId: str(obj(d).itemId),
			editSession: str(obj(d).editSession) || undefined,
			value: {
				done: v.done === true,
				answer: typeof v.answer === "boolean" ? v.answer : undefined,
				at: str(v.at),
				present: Array.isArray(v.present) ? v.present.map(str) : [],
				person: str(v.person),
				reviewers: Array.isArray(v.reviewers)
					? v.reviewers.map((r) => ({
							name: "",
							member: str(obj(r).member) as MemberRef,
						}))
					: [],
				decision: str(v.decision),
				notes: str(v.notes),
			},
		};
	})
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		await protocols.saveItemValue(
			db,
			user.id,
			data.itemId,
			data.value,
			data.editSession,
		);
	});

export const setCarryOver = createServerFn({ method: "POST" })
	.validator((d: unknown) => {
		const flag = (v: unknown) => (typeof v === "boolean" ? v : undefined);
		return {
			itemId: str(obj(d).itemId),
			editSession: str(obj(d).editSession) || undefined,
			tabled: flag(obj(d).tabled),
			followUp: flag(obj(d).followUp),
		};
	})
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		await protocols.setCarryOver(
			db,
			user.id,
			data.itemId,
			{ tabled: data.tabled, followUp: data.followUp },
			data.editSession,
		);
	});

export const closeProtocol = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ protocolId: str(obj(d).protocolId) }))
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		await protocols.closeProtocol(db, user.id, data.protocolId);
	});

/** No login required: the share id itself is the access token. */
export const getPublicProtocol = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ shareId: str(obj(d).shareId) }))
	.handler(async ({ data }) => {
		const { getDb } = await import("./db");
		const { getPublicProtocol } = await import("./protocols.server");
		const db = await getDb();
		const result = await getPublicProtocol(db, data.shareId);
		if (result?.status !== "closed") return result;
		const { getJustering } = await import("./reviews.server");
		const { rows } = await db.execute({
			sql: "SELECT id FROM protocols WHERE share_id = ?",
			args: [data.shareId],
		});
		return {
			...result,
			justering: await getJustering(db, String(rows[0].id)),
		};
	});

export const regenerateProtocolShareId = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ protocolId: str(obj(d).protocolId) }))
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		return protocols.regenerateProtocolShareId(db, user.id, data.protocolId);
	});
