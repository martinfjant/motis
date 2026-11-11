import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";

export type Role = "admin" | "member";
export type Board = { id: string; name: string; role: Role };
export type Member = {
	userId: string;
	name: string;
	email: string;
	role: Role;
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
		],
		"write",
	);
	return { id, name, role: "admin" };
}

export async function listBoards(db: Client, userId: string): Promise<Board[]> {
	const res = await db.execute({
		sql: `SELECT b.id, b.name, m.role FROM boards b
          JOIN board_memberships m ON m.board_id = b.id
          WHERE m.user_id = ? ORDER BY b.name`,
		args: [userId],
	});
	return res.rows.map((r) => ({
		id: String(r.id),
		name: String(r.name),
		role: r.role as Role,
	}));
}

/** The board as seen by this user, or null if they are not a member. */
export async function getBoard(
	db: Client,
	userId: string,
	boardId: string,
): Promise<Board | null> {
	const res = await db.execute({
		sql: `SELECT b.id, b.name, m.role FROM boards b
          JOIN board_memberships m ON m.board_id = b.id
          WHERE b.id = ? AND m.user_id = ?`,
		args: [boardId, userId],
	});
	const r = res.rows[0];
	return r
		? { id: String(r.id), name: String(r.name), role: r.role as Role }
		: null;
}

export async function listMembers(
	db: Client,
	userId: string,
	boardId: string,
): Promise<Member[]> {
	await requireMember(db, userId, boardId);
	const res = await db.execute({
		sql: `SELECT u.id, u.name, u.email, m.role FROM board_memberships m
          JOIN users u ON u.id = m.user_id
          WHERE m.board_id = ? ORDER BY m.created_at, u.name`,
		args: [boardId],
	});
	return res.rows.map((r) => ({
		userId: String(r.id),
		name: String(r.name),
		email: String(r.email),
		role: r.role as Role,
	}));
}

async function requireMember(db: Client, userId: string, boardId: string) {
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
) {
	await requireAdmin(db, actorId, boardId);
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
		sql: "INSERT INTO board_memberships (board_id, user_id, role) VALUES (?, ?, 'member')",
		args: [boardId, userId],
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
