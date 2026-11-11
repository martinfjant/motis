import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { DEFAULT_PATTERN, isPattern } from "../patterns";
import { defaultTemplateStatements } from "./default-template";

export type Role = "admin" | "member";
export type Board = {
	id: string;
	name: string;
	role: Role;
	/** Background pattern id, see src/patterns.ts. */
	background: string;
	/** The current user's title on this board, e.g. "Kassör" ("" if none). */
	title: string;
};
export type Member = {
	userId: string;
	name: string;
	email: string;
	role: Role;
	title: string;
};

export class BoardError extends Error {}

export async function createBoard(
	db: Client,
	userId: string,
	nameInput: string,
): Promise<Board> {
	const name = nameInput.trim();
	if (!name) throw new BoardError("Ange ett namn på styrelsen.");
	const id = randomUUID();
	await db.batch(
		[
			{
				sql: "INSERT INTO boards (id, name, created_by) VALUES (?, ?, ?)",
				args: [id, name, userId],
			},
			{
				sql: "INSERT INTO board_memberships (board_id, user_id, role) VALUES (?, ?, 'admin')",
				args: [id, userId],
			},
			...defaultTemplateStatements(id).statements,
		],
		"write",
	);
	return { id, name, role: "admin", background: DEFAULT_PATTERN, title: "" };
}

export async function listBoards(db: Client, userId: string): Promise<Board[]> {
	const res = await db.execute({
		sql: `SELECT b.id, b.name, b.background, m.role, m.title FROM boards b
          JOIN board_memberships m ON m.board_id = b.id
          WHERE m.user_id = ? ORDER BY b.name`,
		args: [userId],
	});
	return res.rows.map((r) => ({
		id: String(r.id),
		name: String(r.name),
		role: r.role as Role,
		background: String(r.background),
		title: String(r.title),
	}));
}

/** The board as seen by this user, or null if they are not a member. */
export async function getBoard(
	db: Client,
	userId: string,
	boardId: string,
): Promise<Board | null> {
	const res = await db.execute({
		sql: `SELECT b.id, b.name, b.background, m.role, m.title FROM boards b
          JOIN board_memberships m ON m.board_id = b.id
          WHERE b.id = ? AND m.user_id = ?`,
		args: [boardId, userId],
	});
	const r = res.rows[0];
	return r
		? {
				id: String(r.id),
				name: String(r.name),
				role: r.role as Role,
				background: String(r.background),
				title: String(r.title),
			}
		: null;
}

export async function listMembers(
	db: Client,
	userId: string,
	boardId: string,
): Promise<Member[]> {
	await requireMember(db, userId, boardId);
	const res = await db.execute({
		sql: `SELECT u.id, u.name, u.email, m.role, m.title FROM board_memberships m
          JOIN users u ON u.id = m.user_id
          WHERE m.board_id = ? ORDER BY m.created_at, u.name`,
		args: [boardId],
	});
	return res.rows.map((r) => ({
		userId: String(r.id),
		name: String(r.name),
		email: String(r.email),
		role: r.role as Role,
		title: String(r.title),
	}));
}

export async function requireMember(
	db: Client,
	userId: string,
	boardId: string,
) {
	const board = await getBoard(db, userId, boardId);
	if (!board) throw new BoardError("Styrelsen finns inte.");
	return board;
}

export async function requireAdmin(
	db: Client,
	userId: string,
	boardId: string,
) {
	const board = await requireMember(db, userId, boardId);
	if (board.role !== "admin")
		throw new BoardError("Bara administratörer kan göra det här.");
	return board;
}

async function adminCount(db: Client, boardId: string) {
	const res = await db.execute({
		sql: "SELECT COUNT(*) AS n FROM board_memberships WHERE board_id = ? AND role = 'admin'",
		args: [boardId],
	});
	return Number(res.rows[0].n);
}

export async function addMemberByEmail(
	db: Client,
	actorId: string,
	boardId: string,
	emailInput: string,
	titleInput = "",
) {
	await requireAdmin(db, actorId, boardId);
	const title = cleanTitle(titleInput);
	const email = emailInput.trim().toLowerCase();
	const user = await db.execute({
		sql: "SELECT id FROM users WHERE email = ?",
		args: [email],
	});
	if (!user.rows[0])
		throw new BoardError(
			"Det finns inget konto med den e-postadressen. Personen behöver skapa ett konto först.",
		);
	const userId = String(user.rows[0].id);
	const existing = await db.execute({
		sql: "SELECT 1 FROM board_memberships WHERE board_id = ? AND user_id = ?",
		args: [boardId, userId],
	});
	if (existing.rows.length > 0)
		throw new BoardError("Personen är redan med i styrelsen.");
	await db.execute({
		sql: "INSERT INTO board_memberships (board_id, user_id, role, title) VALUES (?, ?, 'member', ?)",
		args: [boardId, userId, title],
	});
}

export async function setMemberRole(
	db: Client,
	actorId: string,
	boardId: string,
	userId: string,
	role: Role,
) {
	await requireAdmin(db, actorId, boardId);
	if (role !== "admin" && role !== "member")
		throw new BoardError("Ogiltig roll.");
	const current = await getBoard(db, userId, boardId);
	if (!current) throw new BoardError("Personen är inte med i styrelsen.");
	if (
		current.role === "admin" &&
		role === "member" &&
		(await adminCount(db, boardId)) <= 1
	)
		throw new BoardError("Styrelsen måste ha minst en administratör.");
	await db.execute({
		sql: "UPDATE board_memberships SET role = ? WHERE board_id = ? AND user_id = ?",
		args: [role, boardId, userId],
	});
}

/** Admins can remove anyone; any member can remove themselves (leave). */
export async function removeMember(
	db: Client,
	actorId: string,
	boardId: string,
	userId: string,
) {
	if (actorId === userId) await requireMember(db, actorId, boardId);
	else await requireAdmin(db, actorId, boardId);
	const target = await getBoard(db, userId, boardId);
	if (!target) throw new BoardError("Personen är inte med i styrelsen.");
	if (target.role === "admin" && (await adminCount(db, boardId)) <= 1)
		throw new BoardError("Styrelsen måste ha minst en administratör.");
	await db.execute({
		sql: "DELETE FROM board_memberships WHERE board_id = ? AND user_id = ?",
		args: [boardId, userId],
	});
}

/** Admins choose the board's background pattern. */
export async function setBackground(
	db: Client,
	actorId: string,
	boardId: string,
	pattern: string,
) {
	await requireAdmin(db, actorId, boardId);
	if (!isPattern(pattern)) throw new BoardError("Okänt bakgrundsmönster.");
	await db.execute({
		sql: "UPDATE boards SET background = ? WHERE id = ?",
		args: [pattern, boardId],
	});
}

/** Members set their own title on a board, e.g. "Ordförande". Empty clears it. */
export async function setMyTitle(
	db: Client,
	userId: string,
	boardId: string,
	titleInput: string,
) {
	await setMemberTitle(db, userId, boardId, userId, titleInput);
}

/** Admins set anyone's title on the board; members only their own. */
export async function setMemberTitle(
	db: Client,
	actorId: string,
	boardId: string,
	userId: string,
	titleInput: string,
) {
	if (actorId === userId) await requireMember(db, actorId, boardId);
	else await requireAdmin(db, actorId, boardId);
	const title = cleanTitle(titleInput);
	const res = await db.execute({
		sql: "UPDATE board_memberships SET title = ? WHERE board_id = ? AND user_id = ?",
		args: [title, boardId, userId],
	});
	if (res.rowsAffected === 0)
		throw new BoardError("Personen är inte med i styrelsen.");
}

function cleanTitle(input: string) {
	const title = input.trim();
	if (title.length > 60) throw new BoardError("Titeln är för lång.");
	return title;
}
