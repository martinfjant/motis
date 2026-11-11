import { createClient } from "@libsql/client";
import { beforeEach, expect, test } from "vitest";
import { createUser } from "./auth.server";
import {
	addMemberByEmail,
	BoardError,
	createBoard,
	getBoard,
	listBoards,
	listMembers,
	removeMember,
	setBackground,
	setMemberRole,
	setMyTitle,
} from "./boards.server";
import { migrate } from "./migrate";

let db: ReturnType<typeof createClient>;
let anna: string, bo: string, cia: string, boardId: string;

const mk = async (name: string) =>
	(
		await createUser(db, {
			name,
			email: `${name}@example.se`,
			password: "hemligt123",
		})
	).id;

beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	anna = await mk("anna");
	bo = await mk("bo");
	cia = await mk("cia");
	boardId = (await createBoard(db, anna, " BRF Björken ")).id;
});

test("creator becomes admin and board is trimmed", async () => {
	const boards = await listBoards(db, anna);
	expect(boards).toEqual([
		{
			id: boardId,
			name: "BRF Björken",
			role: "admin",
			background: "standard",
			title: "",
		},
	]);
	expect(await listBoards(db, bo)).toEqual([]);
	await expect(createBoard(db, anna, "  ")).rejects.toThrow(BoardError);
});

test("non-members cannot see a board or its members", async () => {
	expect(await getBoard(db, bo, boardId)).toBeNull();
	await expect(listMembers(db, bo, boardId)).rejects.toThrow(BoardError);
});

test("admin adds existing accounts only, once", async () => {
	await addMemberByEmail(db, anna, boardId, " BO@example.se ");
	expect((await getBoard(db, bo, boardId))?.role).toBe("member");
	await expect(
		addMemberByEmail(db, anna, boardId, "bo@example.se"),
	).rejects.toThrow(BoardError);
	await expect(
		addMemberByEmail(db, anna, boardId, "nobody@example.se"),
	).rejects.toThrow(BoardError);
});

test("plain members cannot add, promote or remove", async () => {
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	await addMemberByEmail(db, anna, boardId, "cia@example.se");
	await expect(
		addMemberByEmail(db, bo, boardId, "x@example.se"),
	).rejects.toThrow(BoardError);
	await expect(setMemberRole(db, bo, boardId, bo, "admin")).rejects.toThrow(
		BoardError,
	);
	await expect(removeMember(db, bo, boardId, cia)).rejects.toThrow(BoardError);
});

test("admins can promote and demote, but never remove the last admin", async () => {
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	await expect(
		setMemberRole(db, anna, boardId, anna, "member"),
	).rejects.toThrow(BoardError);
	await expect(removeMember(db, anna, boardId, anna)).rejects.toThrow(
		BoardError,
	);
	await setMemberRole(db, anna, boardId, bo, "admin");
	await setMemberRole(db, bo, boardId, anna, "member");
	expect((await getBoard(db, anna, boardId))?.role).toBe("member");
});

test("members can leave, admins can remove others", async () => {
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	await addMemberByEmail(db, anna, boardId, "cia@example.se");
	await removeMember(db, bo, boardId, bo);
	await removeMember(db, anna, boardId, cia);
	expect((await listMembers(db, anna, boardId)).map((m) => m.userId)).toEqual([
		anna,
	]);
});

test("admins choose a known background pattern", async () => {
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	await setBackground(db, anna, boardId, "honeycomb");
	expect((await getBoard(db, bo, boardId))?.background).toBe("honeycomb");
	await expect(setBackground(db, bo, boardId, "hearts")).rejects.toThrow(
		BoardError,
	);
	await expect(setBackground(db, anna, boardId, "url(evil)")).rejects.toThrow(
		BoardError,
	);
	await setBackground(db, anna, boardId, "standard");
	expect((await getBoard(db, anna, boardId))?.background).toBe("standard");
});

test("members set their own title per board", async () => {
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	const other = (await createBoard(db, bo, "BRF Eken")).id;
	await setMyTitle(db, bo, boardId, " Kassör ");
	await setMyTitle(db, bo, other, "Ordförande");
	const title = async (b: string) =>
		(await listMembers(db, bo, b)).find((m) => m.userId === bo)?.title;
	expect(await title(boardId)).toBe("Kassör");
	expect((await getBoard(db, bo, other))?.title).toBe("Ordförande");
	await expect(setMyTitle(db, cia, boardId, "Ordförande")).rejects.toThrow(
		BoardError,
	);
	await expect(setMyTitle(db, bo, boardId, "x".repeat(61))).rejects.toThrow(
		BoardError,
	);
	await setMyTitle(db, bo, boardId, "");
	expect(await title(boardId)).toBe("");
});
