import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { expect, test } from "vitest";
import { migrate, migrations } from "./migrate";

test("migrations apply once and are idempotent", async () => {
	const db = createClient({ url: ":memory:" });
	await migrate(db);
	await migrate(db);
	const tables = await db.execute(
		"SELECT name FROM sqlite_master WHERE type='table' AND name='boards'",
	);
	expect(tables.rows).toHaveLength(1);
	const applied = await db.execute("SELECT name FROM _migrations");
	expect(applied.rows).toHaveLength(migrations.length);
});

test("0012: Val av justerare becomes the reviewers type, except in protocols", async () => {
	const db = createClient({ url: ":memory:" });
	await db.execute(
		"CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at TEXT)",
	);
	for (const m of migrations.filter((m) => m.name < "0012")) {
		await db.executeMultiple(m.sql);
		await db.execute({
			sql: "INSERT INTO _migrations (name) VALUES (?)",
			args: [m.name],
		});
	}
	await db.executeMultiple(`
		INSERT INTO users (id, email, name, password_hash) VALUES ('u', 'u@x.se', 'U', 'x');
		INSERT INTO boards (id, name, created_by) VALUES ('b', 'B', 'u');
		INSERT INTO templates (id, board_id, name) VALUES ('t', 'b', 'Mall');
		INSERT INTO template_items (id, template_id, position, title, type) VALUES
			('t1', 't', 1, 'Val av justerare', 'person'),
			('t2', 't', 2, 'Val av ordförande', 'person');
		INSERT INTO agendas (id, board_id, share_id, title) VALUES ('a1', 'b', 's1', 'Ej startat'), ('a2', 'b', 's2', 'Startat');
		INSERT INTO agenda_items (id, agenda_id, position, title, type) VALUES
			('a1i', 'a1', 1, 'Val av justerare', 'person'),
			('a2i', 'a2', 1, 'Val av justerare', 'person');
		INSERT INTO protocols (id, board_id, agenda_id, share_id, title) VALUES ('p', 'b', 'a2', 'ps', 'Startat');
		INSERT INTO protocol_items (id, protocol_id, position, title, type, value) VALUES
			('pi', 'p', 1, 'Val av justerare', 'person', '{"person":"U"}');
	`);
	await migrate(db);
	const types = await db.execute(`
		SELECT id, type, config FROM template_items UNION ALL
		SELECT id, type, config FROM agenda_items UNION ALL
		SELECT id, type, config FROM protocol_items ORDER BY id`);
	expect(types.rows.map((r) => [r.id, r.type, r.config])).toEqual([
		["a1i", "reviewers", '{"reviewerCount":2}'],
		["a2i", "person", "{}"],
		["pi", "person", "{}"],
		["t1", "reviewers", '{"reviewerCount":2}'],
		["t2", "person", "{}"],
	]);
});

test("0017: attendance moves to right after the opening", async () => {
	const db = createClient({ url: ":memory:" });
	await db.execute(
		"CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at TEXT)",
	);
	for (const m of migrations.filter((m) => m.name < "0017")) {
		await db.executeMultiple(m.sql);
		await db.execute({
			sql: "INSERT INTO _migrations (name) VALUES (?)",
			args: [m.name],
		});
	}
	await db.executeMultiple(`
		INSERT INTO users (id, email, name, password_hash) VALUES ('u', 'u@x.se', 'U', 'x');
		INSERT INTO boards (id, name, created_by) VALUES ('b', 'B', 'u');
		INSERT INTO templates (id, board_id, name) VALUES ('t', 'b', 'Mall'), ('t2', 'b', 'Utan öppning');
		INSERT INTO template_items (id, template_id, position, title, type) VALUES
			('t1', 't', 1, 'Öppnande', 'open'),
			('t2', 't', 2, 'Ordförande', 'person'),
			('t3', 't', 3, 'Justerare', 'reviewers'),
			('t4', 't', 4, 'Närvaro', 'attendance'),
			('t5', 't', 5, 'Ekonomi', 'text'),
			('u1', 't2', 1, 'Ekonomi', 'text'),
			('u2', 't2', 2, 'Närvaro', 'attendance');
		INSERT INTO agendas (id, board_id, share_id, title) VALUES ('a1', 'b', 's1', 'Ej startat'), ('a2', 'b', 's2', 'Startat');
		INSERT INTO agenda_items (id, agenda_id, position, title, type) VALUES
			('a1a', 'a1', 1, 'Öppnande', 'open'),
			('a1b', 'a1', 2, 'Ordförande', 'person'),
			('a1c', 'a1', 3, 'Närvaro', 'attendance'),
			('a2a', 'a2', 1, 'Öppnande', 'open'),
			('a2b', 'a2', 2, 'Ordförande', 'person'),
			('a2c', 'a2', 3, 'Närvaro', 'attendance');
		INSERT INTO protocols (id, board_id, agenda_id, share_id, title) VALUES ('p', 'b', 'a2', 'ps', 'Startat');
	`);
	await migrate(db);
	const order = async (sql: string) =>
		(await db.execute(sql)).rows.map((r) => `${r.position}:${r.id}`);
	expect(
		await order(
			"SELECT id, position FROM template_items WHERE template_id = 't' ORDER BY position",
		),
	).toEqual(["1:t1", "2:t4", "3:t2", "4:t3", "5:t5"]);
	// Without an opening point, nothing moves.
	expect(
		await order(
			"SELECT id, position FROM template_items WHERE template_id = 't2' ORDER BY position",
		),
	).toEqual(["1:u1", "2:u2"]);
	expect(
		await order(
			"SELECT id, position FROM agenda_items ORDER BY agenda_id, position",
		),
	).toEqual(["1:a1a", "2:a1c", "3:a1b", "1:a2a", "2:a2b", "3:a2c"]);
});

test("a failing migration leaves nothing behind", async () => {
	const db = createClient({ url: ":memory:" });
	await migrate(db);
	const broken = {
		name: "9999_broken.sql",
		sql: "CREATE TABLE half (id TEXT); INSERT INTO nowhere VALUES (1);",
	};
	migrations.push(broken);
	try {
		await expect(migrate(db)).rejects.toThrow();
	} finally {
		migrations.pop();
	}
	const half = await db.execute(
		"SELECT name FROM sqlite_master WHERE name = 'half'",
	);
	expect(half.rows).toHaveLength(0);
	const recorded = await db.execute(
		"SELECT 1 FROM _migrations WHERE name = '9999_broken.sql'",
	);
	expect(recorded.rows).toHaveLength(0);
});

test("two instances migrating the same database at once apply everything once", async () => {
	const dir = mkdtempSync(join(tmpdir(), "migrate-"));
	try {
		const url = `file:${join(dir, "db.sqlite")}`;
		const a = createClient({ url });
		const b = createClient({ url });
		await Promise.all([migrate(a), migrate(b)]);
		const applied = await a.execute("SELECT COUNT(*) AS n FROM _migrations");
		expect(Number(applied.rows[0].n)).toBe(migrations.length);
		a.close();
		b.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
