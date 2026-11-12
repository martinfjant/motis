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
	const meetings = await import("./meetings.server");
	return { ...(await requireUser()), agendas, boards, protocols, meetings };
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
		const { db, user, agendas, boards, protocols, meetings } = await ctx();
		const board = await boards.getBoard(db, user.id, data.boardId);
		if (!board) return null;
		return {
			board,
			agendas: await agendas.listAgendas(db, user.id, board.id),
			protocols: await protocols.listProtocols(db, user.id, board.id),
			templates: await agendas.listTemplates(db, user.id, board.id),
			plan: await meetings.getMeetingPlan(db, user.id, board.id),
			/** Today in Sweden, so "om 3 dagar" renders the same everywhere. */
			today: meetings.today(),
		};
	});

/** Coming meetings on all the user's boards, for the start page. */
export const getUpcomingMeetings = createServerFn({ method: "GET" }).handler(
	async () => {
		const { db, user, meetings } = await ctx();
		return meetings.listUpcoming(db, user.id);
	},
);

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

/** "Kalla till möte": a new agenda, with points carried over if chosen. */
export const callMeeting = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		...details(d),
		boardId: str(obj(d).boardId),
		templateId: str(obj(d).templateId) || undefined,
		carryOver: strList(obj(d).carryOver),
	}))
	.handler(async ({ data }) => {
		const { db, user, meetings } = await ctx();
		return meetings.callMeeting(db, user.id, data.boardId, data);
	});

export const getAgenda = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ agendaId: str(obj(d).agendaId) }))
	.handler(async ({ data }) => {
		const { db, user, agendas, meetings } = await ctx();
		const result = await orNull(agendas.getAgenda(db, user.id, data.agendaId));
		// Today in Sweden, to tell whether the meeting can be started.
		return result && { ...result, today: meetings.today() };
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

/** Set while editing a closed protocol; see guardProtocolEdit. */
const editSession = (d: unknown) => str(obj(d).editSession) || undefined;

const itemInput = (d: unknown) => ({
	title: str(obj(d).title),
	type: str(obj(d).type),
	description: str(obj(d).description),
	extraNames: strList(obj(d).extraNames),
	reviewerCount: obj(d).reviewerCount,
});

export const addItem = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		...itemInput(d),
		kind: kind(obj(d).kind),
		editSession: editSession(d),
		parentId: str(obj(d).parentId),
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.addItem(
			db,
			user.id,
			data.kind,
			data.parentId,
			data,
			data.editSession,
		);
	});

export const updateItem = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		...itemInput(d),
		kind: kind(obj(d).kind),
		editSession: editSession(d),
		itemId: str(obj(d).itemId),
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.updateItem(
			db,
			user.id,
			data.kind,
			data.itemId,
			data,
			data.editSession,
		);
	});

export const moveItem = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		kind: kind(obj(d).kind),
		editSession: editSession(d),
		itemId: str(obj(d).itemId),
		direction: (obj(d).direction === -1 ? -1 : 1) as -1 | 1,
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.moveItem(
			db,
			user.id,
			data.kind,
			data.itemId,
			data.direction,
			data.editSession,
		);
	});

export const deleteItem = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		kind: kind(obj(d).kind),
		editSession: editSession(d),
		itemId: str(obj(d).itemId),
	}))
	.handler(async ({ data }) => {
		const { db, user, agendas } = await ctx();
		await agendas.deleteItem(
			db,
			user.id,
			data.kind,
			data.itemId,
			data.editSession,
		);
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
