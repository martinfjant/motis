import type { Client } from "@libsql/client";

// Migrations are bundled as raw strings so they ship inside the build.
const files = import.meta.glob("./migrations/*.sql", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

export const migrations = Object.entries(files)
	.map(([path, sql]) => ({ name: path.split("/").pop() as string, sql }))
	.sort((a, b) => a.name.localeCompare(b.name));

export async function migrate(client: Client) {
	await client.execute(
		`CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
	);
	const done = await client.execute("SELECT name FROM _migrations");
	const applied = new Set(done.rows.map((r) => String(r.name)));

	for (const m of migrations) {
		if (applied.has(m.name)) continue;
		await client.executeMultiple(m.sql);
		await client.execute({
			sql: "INSERT INTO _migrations (name) VALUES (?)",
			args: [m.name],
		});
	}
}
