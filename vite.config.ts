import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { redact } from "@tanstack/redact/vite";

import viteReact from "@vitejs/plugin-react";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";

/**
 * Development only: Nitro's dev server hands requests the browser marks as
 * images (Sec-Fetch-Dest: image) to Vite as static files, so <img> of an
 * /api/ route (e.g. a board's logo) never reached the app. Production has no
 * such step. Must come before nitro() in the plugin list.
 */
function apiRequestsToApp(): Plugin {
	return {
		name: "motis:api-requests-to-app",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				if (req.url?.startsWith("/api/")) delete req.headers["sec-fetch-dest"];
				next();
			});
		},
	};
}

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	// Bundle server deps so Redact can redirect their React imports too.
	// Kept external, loaded from node_modules at runtime: libSQL and sharp
	// (native bindings), pdfmake (reads its font files from its own folder)
	// and pdf-lib (its tslib helpers break when bundled).
	ssr: {
		noExternal: [/^(?!@?libsql|pdfmake|pdf-lib|@pdf-lib\/|sharp|@img\/)/],
	},
	plugins: [
		// Development only: Option+Shift+click an element in the browser to open
		// the line that renders it in your editor. Adds the source location to
		// every element at compile time, so it works with Redact too.
		codeInspectorPlugin({ bundler: "vite" }),
		apiRequestsToApp(),
		nitro({
			rollupConfig: {
				external: [
					/^@sentry\//,
					/^@?libsql/,
					/^pdfmake/,
					/^pdf-lib/,
					/^@pdf-lib\//,
					/^sharp/,
					/^@img\//,
				],
			},
		}),

		tailwindcss(),
		tanstackStart(),
		viteReact(),
		redact(),
	],
});

export default config;
