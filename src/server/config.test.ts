import { afterEach, expect, test, vi } from "vitest";
import { fileStorageConfig, regionOf } from "./config.server";

afterEach(() => vi.unstubAllEnvs());

test("the storage region comes from Bunny's hostname", () => {
	expect(regionOf("se.storage.bunnycdn.com")).toBe("se");
	expect(regionOf("https://uk.storage.bunnycdn.com/")).toBe("uk");
	expect(regionOf("storage.bunnycdn.com")).toBe("de");
	expect(regionOf("example.com")).toBeUndefined();
	expect(regionOf(undefined)).toBeUndefined();
});

test("Bunny's own setting names for a linked storage zone are used", () => {
	vi.stubEnv("BUNNY_STORAGE_ZONE", "");
	vi.stubEnv("BUNNY_STORAGE_KEY", "");
	vi.stubEnv("BUNNY_STORAGE_REGION", "");
	vi.stubEnv("STORAGE_ZONE", "motis-files");
	vi.stubEnv("STORAGE_ACCESS_KEY", "hemlig");
	vi.stubEnv("STORAGE_HOSTNAME", "se.storage.bunnycdn.com");
	expect(fileStorageConfig()).toEqual({
		kind: "bunny",
		zone: "motis-files",
		accessKey: "hemlig",
		region: "se",
	});
});
