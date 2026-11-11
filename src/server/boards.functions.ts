import { createServerFn } from "@tanstack/react-start";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (d: unknown) => (d ?? {}) as Record<string, unknown>;

async function ctx() {
	const { requireUser } = await import("./session.server");
	const boards = await import("./boards.server");
	return { ...(await requireUser()), boards };
}

export const getMyBoards = createServerFn({ method: "GET" }).handler(
	async () => {
		const { db, user, boards } = await ctx();
		return boards.listBoards(db, user.id);
	},
);

export const createBoard = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ name: str(obj(d).name) }))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		return boards.createBoard(db, user.id, data.name);
	});

export const getBoardDetails = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ boardId: str(obj(d).boardId) }))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		const board = await boards.getBoard(db, user.id, data.boardId);
		if (!board) return null;
		return {
			board,
			currentUserId: user.id,
			members: await boards.listMembers(db, user.id, data.boardId),
		};
	});

export const addMember = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		boardId: str(obj(d).boardId),
		email: str(obj(d).email),
		title: str(obj(d).title),
	}))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		await boards.addMemberByEmail(
			db,
			user.id,
			data.boardId,
			data.email,
			data.title,
		);
	});

export const changeMemberRole = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		boardId: str(obj(d).boardId),
		userId: str(obj(d).userId),
		role: str(obj(d).role) as "admin" | "member",
	}))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		await boards.setMemberRole(
			db,
			user.id,
			data.boardId,
			data.userId,
			data.role,
		);
	});

export const removeBoardMember = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		boardId: str(obj(d).boardId),
		userId: str(obj(d).userId),
	}))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		await boards.removeMember(db, user.id, data.boardId, data.userId);
	});

export const setBoardBackground = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		boardId: str(obj(d).boardId),
		pattern: str(obj(d).pattern),
	}))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		await boards.setBackground(db, user.id, data.boardId, data.pattern);
	});

export const setMyTitle = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		boardId: str(obj(d).boardId),
		title: str(obj(d).title),
	}))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		await boards.setMyTitle(db, user.id, data.boardId, data.title);
	});

export const setMemberTitle = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		boardId: str(obj(d).boardId),
		userId: str(obj(d).userId),
		title: str(obj(d).title),
	}))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		await boards.setMemberTitle(
			db,
			user.id,
			data.boardId,
			data.userId,
			data.title,
		);
	});
