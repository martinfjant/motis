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

/** A board member without an account; see board_unregistered_members. */
export type UnregisteredMember = {
	id: string;
	name: string;
	email: string;
	title: string;
	/** Someone has registered with this email and can be linked up. */
	hasAccount: boolean;
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
	// If they were on the board without an account, this replaces that.
	const unregistered = await db.execute({
		sql: "SELECT title FROM board_unregistered_members WHERE board_id = ? AND email = ?",
		args: [boardId, email],
	});
	const keptTitle = title || String(unregistered.rows[0]?.title ?? "");
	await db.batch(
		[
			{
				sql: "INSERT INTO board_memberships (board_id, user_id, role, title) VALUES (?, ?, 'member', ?)",
				args: [boardId, userId, keptTitle],
			},
			{
				sql: "DELETE FROM board_unregistered_members WHERE board_id = ? AND email = ?",
				args: [boardId, email],
			},
		],
		"write",
	);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanPerson(input: { name: string; email: string; title: string }) {
	const name = input.name.trim();
	const email = input.email.trim().toLowerCase();
	if (!name) throw new BoardError("Ange personens namn.");
	if (name.length > 100) throw new BoardError("Namnet är för långt.");
	if (email && !EMAIL.test(email))
		throw new BoardError("Ange en giltig e-postadress.");
	return { name, email, title: cleanTitle(input.title) };
}

async function accountExists(db: Client, email: string) {
	if (!email) return false;
	const res = await db.execute({
		sql: "SELECT 1 FROM users WHERE email = ?",
		args: [email],
	});
	return res.rows.length > 0;
}

/** Throws if the email is already used by someone on the board. */
async function requireFreeEmail(
	db: Client,
	boardId: string,
	email: string,
	exceptId = "",
) {
	if (!email) return;
	const res = await db.execute({
		sql: `SELECT 1 FROM board_unregistered_members WHERE board_id = ? AND email = ? AND id != ?
          UNION ALL
          SELECT 1 FROM board_memberships m JOIN users u ON u.id = m.user_id
          WHERE m.board_id = ? AND u.email = ?`,
		args: [boardId, email, exceptId, boardId, email],
	});
	if (res.rows.length > 0)
		throw new BoardError("Någon i styrelsen har redan den e-postadressen.");
}

/**
 * "Lägg till ledamot": someone with an account (found by email) becomes a
 * member; anyone else is added without an account, which needs a name.
 */
export async function addMember(
	db: Client,
	actorId: string,
	boardId: string,
	input: { name: string; email: string; title: string },
): Promise<{ registered: boolean }> {
	await requireAdmin(db, actorId, boardId);
	const email = input.email.trim().toLowerCase();
	if (await accountExists(db, email)) {
		await addMemberByEmail(db, actorId, boardId, email, input.title);
		return { registered: true };
	}
	const person = cleanPerson(input);
	await requireFreeEmail(db, boardId, person.email);
	await db.execute({
		sql: "INSERT INTO board_unregistered_members (id, board_id, name, email, title) VALUES (?, ?, ?, ?, ?)",
		args: [randomUUID(), boardId, person.name, person.email, person.title],
	});
	return { registered: false };
}

export async function listUnregistered(
	db: Client,
	userId: string,
	boardId: string,
): Promise<UnregisteredMember[]> {
	await requireMember(db, userId, boardId);
	const res = await db.execute({
		sql: `SELECT r.*, u.id AS user_id FROM board_unregistered_members r
          LEFT JOIN users u ON r.email != '' AND u.email = r.email
          WHERE r.board_id = ? ORDER BY r.name`,
		args: [boardId],
	});
	return res.rows.map((r) => ({
		id: String(r.id),
		name: String(r.name),
		email: String(r.email),
		title: String(r.title),
		hasAccount: r.user_id != null,
	}));
}

async function requireUnregistered(db: Client, boardId: string, id: string) {
	const res = await db.execute({
		sql: "SELECT * FROM board_unregistered_members WHERE id = ? AND board_id = ?",
		args: [id, boardId],
	});
	if (!res.rows[0]) throw new BoardError("Personen finns inte i styrelsen.");
	return res.rows[0];
}

export async function updateUnregistered(
	db: Client,
	actorId: string,
	boardId: string,
	id: string,
	input: { name: string; email: string; title: string },
) {
	await requireAdmin(db, actorId, boardId);
	await requireUnregistered(db, boardId, id);
	const person = cleanPerson(input);
	await requireFreeEmail(db, boardId, person.email, id);
	await db.execute({
		sql: "UPDATE board_unregistered_members SET name = ?, email = ?, title = ? WHERE id = ?",
		args: [person.name, person.email, person.title, id],
	});
}

export async function removeUnregistered(
	db: Client,
	actorId: string,
	boardId: string,
	id: string,
) {
	await requireAdmin(db, actorId, boardId);
	await requireUnregistered(db, boardId, id);
	await db.execute({
		sql: "DELETE FROM board_unregistered_members WHERE id = ?",
		args: [id],
	});
}

/**
 * Makes a member without an account a registered member, once someone has
 * registered with their email. Registering with someone's address must not
 * by itself give access to the board, so until the account's owner confirms
 * the address (which links them automatically, see markVerified in
 * account.server.ts) an admin does this by hand.
 */
export async function linkUnregistered(
	db: Client,
	actorId: string,
	boardId: string,
	id: string,
) {
	await requireAdmin(db, actorId, boardId);
	const row = await requireUnregistered(db, boardId, id);
	if (!(await accountExists(db, String(row.email))))
		throw new BoardError("Det finns inget konto med personens e-postadress.");
	await addMemberByEmail(
		db,
		actorId,
		boardId,
		String(row.email),
		String(row.title),
	);
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
