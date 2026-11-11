import { createServerFn } from "@tanstack/react-start";

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
		try {
			return await protocols.getProtocol(db, user.id, data.protocolId);
		} catch (err) {
			if (err instanceof BoardError) return null;
			throw err;
		}
	});

export const updateProtocol = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		protocolId: str(obj(d).protocolId),
		title: str(obj(d).title),
		meetingAt: str(obj(d).meetingAt),
		location: str(obj(d).location),
	}))
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		await protocols.updateProtocol(db, user.id, data.protocolId, data);
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
			value: {
				done: v.done === true,
				at: str(v.at),
				present: Array.isArray(v.present) ? v.present.map(str) : [],
				person: str(v.person),
				decision: str(v.decision),
				notes: str(v.notes),
			},
		};
	})
	.handler(async ({ data }) => {
		const { db, user, protocols } = await ctx();
		await protocols.saveItemValue(db, user.id, data.itemId, data.value);
	});
