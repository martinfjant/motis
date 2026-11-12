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

/**
 * Applies the migrations not yet applied, in order. Each runs in its own
 * write transaction together with its row in _migrations, so it is applied
 * completely or not at all. Several instances starting at once (replicas
 * in several regions) take turns: whoever gets the write lock second sees
 * the migration already recorded and skips it.
 */
export async function migrate(client: Client) {
	// Another instance holding the write lock makes SQLite answer "busy";
	// wait a moment and start over. Safe, since every step is re-checked.
	for (let attempt = 1; ; attempt++) {
		try {
			return await migrateOnce(client);
		} catch (err) {
			const busy = (err as { code?: string }).code === "SQLITE_BUSY";
			if (!busy || attempt >= 50) throw err;
			await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));
		}
	}
}

async function migrateOnce(client: Client) {
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
		const tx = await client.transaction("write");
		try {
			// Checked again inside the lock: another instance may have just done it.
			const already = await tx.execute({
				sql: "SELECT 1 FROM _migrations WHERE name = ?",
				args: [m.name],
			});
			if (already.rows.length === 0) {
				await tx.executeMultiple(m.sql);
				await tx.execute({
					sql: "INSERT INTO _migrations (name) VALUES (?)",
					args: [m.name],
				});
			}
			await tx.commit();
		} finally {
			tx.close();
		}
	}
}
