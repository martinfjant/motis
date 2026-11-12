import { type Client, createClient } from "@libsql/client";
import { databaseConfig } from "./config.server";
import { migrate } from "./migrate";

let client: Client | undefined;
let ready: Promise<Client> | undefined;

// Locally this is a plain SQLite file; in production it is Bunny Database
// (libSQL), see databaseConfig. Migrations run on first use. If that fails
// (e.g. the database is unreachable) the next request tries again.
export function getDb(): Promise<Client> {
	ready ??= (async () => {
		client = createClient(databaseConfig());
		await client.execute("PRAGMA foreign_keys = ON");
		await migrate(client);
		return client;
	})().catch((err) => {
		ready = undefined;
		client?.close();
		client = undefined;
		throw err;
	});
	return ready;
}
