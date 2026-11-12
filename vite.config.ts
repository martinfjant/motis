import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { redact } from "@tanstack/redact/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	// Bundle server deps so Redact can redirect their React imports too.
	// Kept external, loaded from node_modules at runtime: libSQL (a native
	// binding) and pdfmake (reads its font files from its own folder).
	ssr: { noExternal: [/^(?!@?libsql|pdfmake)/] },
	plugins: [
		nitro({
			rollupConfig: { external: [/^@sentry\//, /^@?libsql/, /^pdfmake/] },
		}),

		tailwindcss(),
		tanstackStart(),
		viteReact(),
		redact(),
	],
});

export default config;
