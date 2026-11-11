import { createServerFn } from "@tanstack/react-start";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (d: unknown) => (d ?? {}) as Record<string, unknown>;
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str) : []);
const kind = (v: unknown): "agenda" | "template" | "protocol" =>
	v === "agenda" || v === "protocol" ? v : "template";

async function ctx() {
	const { requireUser } = await import("./session.server");
	const agendas = await import("./agendas.server");
	const boards = await import("./boards.server");
	const protocols = await import("./protocols.server");
	return { ...(await requireUser()), agendas, boards, protocols };
}

/** Lets loaders turn "not found / not a member" into a 404 instead of an error. */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
	const { BoardError } = await import("./boards.server");
	try {
		return await p;
	} catch (err) {
		if (err instanceof BoardError) return null;
		throw err;
	}
}

export const getBoardOverview = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ boardId: str(obj(d).boardId) }))
	.handler(async ({ data }) => {
		const { db, user, agendas, boards, protocols } = await ctx();
		const board = await boards.getBoard(db, user.id, data.boardId);
		if (!board) return null;
		return {
			board,
			agendas: await agendas.listAgendas(db, user.id, board.id),
			protocols: await protocols.listProtocols(db, user.id, board.id),
			templates: await agendas.listTemplates(db, user.id, board.id),
		};
	});

// ---------- Templates ----------

export const createTemplate = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		boardId: str(obj(d).boardId),
		name: str(obj(d).name),
		fromDefault: obj(d).fromDefault === true,
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		return agendas.createTemplate(db, user.id, data.boardId, data);
	});

export const getTemplate = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ templateId: str(obj(d).templateId) }))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		return orNull(agendas.getTemplate(db, user.id, data.templateId));
	});

export const renameTemplate = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		templateId: str(obj(d).templateId),
		name: str(obj(d).name),
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.renameTemplate(db, user.id, data.templateId, data.name);
	});

export const deleteTemplate = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ templateId: str(obj(d).templateId) }))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.deleteTemplate(db, user.id, data.templateId);
	});

// ---------- Agendas ----------

const details = (d: unknown) => ({
	title: str(obj(d).title),
	meetingAt: str(obj(d).meetingAt),
	location: str(obj(d).location),
});

export const createAgenda = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		...details(d),
		boardId: str(obj(d).boardId),
		templateId: str(obj(d).templateId) || undefined,
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		return agendas.createAgenda(db, user.id, data.boardId, data);
	});

export const getAgenda = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ agendaId: str(obj(d).agendaId) }))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		return orNull(agendas.getAgenda(db, user.id, data.agendaId));
	});

export const updateAgenda = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		...details(d),
		agendaId: str(obj(d).agendaId),
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.updateAgenda(db, user.id, data.agendaId, data);
	});

export const deleteAgenda = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ agendaId: str(obj(d).agendaId) }))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.deleteAgenda(db, user.id, data.agendaId);
	});

// ---------- Items ----------

const itemInput = (d: unknown) => ({
	title: str(obj(d).title),
	type: str(obj(d).type),
	description: str(obj(d).description),
	extraNames: strList(obj(d).extraNames),
});

export const addItem = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		...itemInput(d),
		kind: kind(obj(d).kind),
		parentId: str(obj(d).parentId),
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.addItem(db, user.id, data.kind, data.parentId, data);
	});

export const updateItem = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		...itemInput(d),
		kind: kind(obj(d).kind),
		itemId: str(obj(d).itemId),
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.updateItem(db, user.id, data.kind, data.itemId, data);
	});

export const moveItem = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		kind: kind(obj(d).kind),
		itemId: str(obj(d).itemId),
		direction: (obj(d).direction === -1 ? -1 : 1) as -1 | 1,
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.moveItem(db, user.id, data.kind, data.itemId, data.direction);
	});

export const deleteItem = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		kind: kind(obj(d).kind),
		itemId: str(obj(d).itemId),
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.deleteItem(db, user.id, data.kind, data.itemId);
	});

// ---------- Public sharing ----------

/** No login required: the share id itself is the access token. */
export const getPublicAgenda = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ shareId: str(obj(d).shareId) }))
	.handler(async ({ data }) => {
		const { getDb } = await import("./db");
		const { getPublicAgenda } = await import("./agendas.server");
		return getPublicAgenda(await getDb(), data.shareId);
	});

export const regenerateAgendaShareId = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ agendaId: str(obj(d).agendaId) }))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		return agendas.regenerateShareId(db, user.id, data.agendaId);
	});
