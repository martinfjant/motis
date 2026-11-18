import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileStorageConfig } from "../config.server";

// Uploaded files (logos, banners, attachments), kept by key, e.g.
// "bilagor/<sha256>". In production in a Bunny storage zone, through Bunny's
// SDK; in development and tests in a local folder. Nothing here checks who
// may see a file: the routes that serve them do.

export type FileStorage = {
	put(key: string, data: Uint8Array, contentType: string): Promise<void>;
	/** The file's content, or null if there is no such file. */
	get(key: string): Promise<Uint8Array | null>;
	/** Removes the file; nothing happens if it isn't there. */
	remove(key: string): Promise<void>;
};

/** Keys are made by the app: letters, digits, - and _, in folders. */
const KEY = /^[a-z0-9-]+(\/[A-Za-z0-9._-]+)+$/;
function checkKey(key: string) {
	if (!KEY.test(key) || key.includes(".."))
		throw new Error(`Ogiltig filnyckel: ${key}`);
}

let storage: FileStorage | undefined;

/** The storage the settings point at (see fileStorageConfig). */
export async function getFileStorage(): Promise<FileStorage> {
	if (storage) return storage;
	const config = fileStorageConfig();
	storage =
		config.kind === "bunny"
			? await bunnyStorage(config.zone, config.accessKey, config.region)
			: folderStorage(config.dir);
	return storage;
}

/** Files in a local folder, for development and tests. */
export function folderStorage(dir: string): FileStorage {
	const root = resolve(dir);
	const path = (key: string) => {
		checkKey(key);
		return join(root, key);
	};
	return {
		async put(key, data) {
			const file = path(key);
			await mkdir(dirname(file), { recursive: true });
			await writeFile(file, data);
		},
		async get(key) {
			try {
				return new Uint8Array(await readFile(path(key)));
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
				throw err;
			}
		},
		async remove(key) {
			await rm(path(key), { force: true });
		},
	};
}

/** Files in a Bunny storage zone. */
async function bunnyStorage(
	zoneName: string,
	accessKey: string,
	region: string,
): Promise<FileStorage> {
	const sdk = await import("@bunny.net/storage-sdk");
	const regions = Object.values(sdk.regions.StorageRegion) as string[];
	if (!regions.includes(region))
		throw new Error(`Okänd region för lagringszonen: ${region}`);
	const zone = sdk.zone.connect_with_accesskey(
		region as (typeof sdk.regions.StorageRegion)[keyof typeof sdk.regions.StorageRegion],
		zoneName,
		accessKey,
	);
	// The SDK puts the path right after "<zone>/", so no leading slash.
	const missing = (err: unknown) => /File not found/.test(String(err));
	return {
		async put(key, data, contentType) {
			checkKey(key);
			const checksum = createHash("sha256").update(data).digest("hex");
			await sdk.file.upload(
				zone,
				key,
				// (Node's stream type, which the SDK names, differs only on paper.)
				new Response(new Uint8Array(data)).body as unknown as Parameters<
					typeof sdk.file.upload
				>[2],
				// Bunny checks the upload against it.
				{ contentType, sha256Checksum: checksum.toUpperCase() },
			);
		},
		async get(key) {
			checkKey(key);
			try {
				const { response } = await sdk.file.download(zone, key);
				return new Uint8Array(await response.arrayBuffer());
			} catch (err) {
				if (missing(err)) return null;
				throw err;
			}
		},
		async remove(key) {
			checkKey(key);
			// Not there is fine; anything else (e.g. a wrong password) is not.
			try {
				await sdk.file.remove(zone, key, { throwOnError: true });
			} catch (err) {
				if (!missing(err)) throw err;
			}
		},
	};
}
