import { createServerFn } from "@tanstack/react-start";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (d: unknown) => (d ?? {}) as Record<string, unknown>;

/** A static page by its address ("integritet", "hjalp/moten"), or null. */
export const getPage = createServerFn({ method: "GET" })
	.validator((d: unknown) => ({ path: str(obj(d).path) }))
	.handler(async ({ data }) => {
		const { findPage } = await import("./pages.server");
		return findPage(data.path);
	});

/** The static pages listed in the site's footer. */
export const getFooterLinks = createServerFn({ method: "GET" }).handler(
	async () => {
		const { footerLinks } = await import("./pages.server");
		return footerLinks();
	},
);
