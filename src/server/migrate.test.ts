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
