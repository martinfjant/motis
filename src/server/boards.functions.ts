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
			unregistered: await boards.listUnregistered(db, user.id, data.boardId),
		};
	});

const person = (d: unknown) => ({
	name: str(obj(d).name),
	email: str(obj(d).email),
	title: str(obj(d).title),
});

export const addMember = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ ...person(d), boardId: str(obj(d).boardId) }))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		return boards.addMember(db, user.id, data.boardId, data);
	});

const unregisteredRef = (d: unknown) => ({
	boardId: str(obj(d).boardId),
	id: str(obj(d).id),
});

export const updateUnregistered = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({ ...person(d), ...unregisteredRef(d) }))
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		await boards.updateUnregistered(db, user.id, data.boardId, data.id, data);
	});

export const removeUnregistered = createServerFn({ method: "POST" })
	.validator(unregisteredRef)
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		await boards.removeUnregistered(db, user.id, data.boardId, data.id);
	});

export const linkUnregistered = createServerFn({ method: "POST" })
	.validator(unregisteredRef)
	.handler(async ({ data }) => {
		const { db, user, boards } = await ctx();
		await boards.linkUnregistered(db, user.id, data.boardId, data.id);
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

/** An uploaded file sent as form data, read at the server. */
function uploaded(form: FormData, name: string): File {
	const file = form.get(name);
	if (!(file instanceof File) || file.size === 0)
		throw new Error("Välj en fil.");
	return file;
}

/**
 * Admins upload the board's logo or banner picture (form data: boardId,
 * which = "logo" | "banner", file). It is made anew at a sensible size.
 */
export const uploadBoardImage = createServerFn({ method: "POST" })
	.validator((d: unknown) => {
		if (!(d instanceof FormData)) throw new Error("Ogiltig uppladdning.");
		const which = d.get("which");
		if (which !== "logo" && which !== "banner")
			throw new Error("Ogiltig bild.");
		return {
			boardId: str(d.get("boardId")),
			which: which as "logo" | "banner",
			file: uploaded(d, "file"),
		};
	})
	.handler(async ({ data }) => {
		const { db, user } = await ctx();
		const images = await import("./files/board-images.server");
		const { BoardError } = await import("./boards.server");
		if (data.file.size > images.MAX_IMAGE_BYTES)
			throw new BoardError("Bilden är för stor (högst 15 MB).");
		await images.setBoardImage(
			db,
			user.id,
			data.boardId,
			data.which,
			new Uint8Array(await data.file.arrayBuffer()),
		);
	});

export const removeBoardImage = createServerFn({ method: "POST" })
	.validator((d: unknown) => {
		const which = obj(d).which;
		if (which !== "logo" && which !== "banner")
			throw new Error("Ogiltig bild.");
		return { boardId: str(obj(d).boardId), which: which as "logo" | "banner" };
	})
	.handler(async ({ data }) => {
		const { db, user } = await ctx();
		const images = await import("./files/board-images.server");
		await images.removeBoardImage(db, user.id, data.boardId, data.which);
	});
