import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { redact } from "@tanstack/redact/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	// Bundle server deps so Redact can redirect their React imports too.
	// libSQL ships a native binding, so it must stay external.
	ssr: { noExternal: [/^(?!@?libsql)/] },
	plugins: [
		nitro({ rollupConfig: { external: [/^@sentry\//, /^@?libsql/] } }),

		tanstackStart(),
		viteReact(),
		redact(),
	],
});

export default config;
