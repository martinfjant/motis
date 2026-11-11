import { type Client, createClient } from "@libsql/client";
import { migrate } from "./migrate";

let client: Client | undefined;
let ready: Promise<Client> | undefined;

// Locally this is a plain SQLite file; in production DATABASE_URL/DATABASE_AUTH_TOKEN
// point at Bunny Database (libSQL).
export function getDb(): Promise<Client> {
	ready ??= (async () => {
		client = createClient({
			url: process.env.DATABASE_URL ?? "file:local.db",
			authToken: process.env.DATABASE_AUTH_TOKEN,
		});
		await client.execute("PRAGMA foreign_keys = ON");
		await migrate(client);
		return client;
	})();
	return ready;
}
