import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: the whole app in a real browser (WebKit, as in Safari),
// against its own dev server on port 3100 and a fresh database, so the
// development server on 3000 and local.db are left alone. Run with
// `pnpm e2e`. Mail goes to the development outbox (/utkorg), where the
// tests read the links.
const PORT = 3100;
const DB = "e2e/.data/e2e.db";

export default defineConfig({
	testDir: "e2e",
	testMatch: "**/*.e2e.ts",
	timeout: 120_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["github"], ["list"]] : "list",
	use: {
		baseURL: `http://localhost:${PORT}`,
		locale: "sv-SE",
		timezoneId: "Europe/Stockholm",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
	webServer: {
		command: `rm -rf e2e/.data && mkdir -p e2e/.data && vite dev --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			DATABASE_URL: `file:${DB}`,
			// Uploaded files (attachments, logos) next to the database.
			FILES_DIR: "e2e/.data/files",
			BUNNY_STORAGE_ZONE: "",
			BUNNY_STORAGE_KEY: "",
			STORAGE_ZONE: "",
			STORAGE_ACCESS_KEY: "",
			APP_URL: `http://localhost:${PORT}`,
			SIGNUP_PASSWORD: "e2e-kod",
			// Never real email from the tests, whatever .env says: everything
			// goes to the outbox, where the tests read it.
			RESEND_API_KEY: "",
			DEV_MAIL_TO: "",
		},
	},
});
