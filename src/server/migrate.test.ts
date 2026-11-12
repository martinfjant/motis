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
