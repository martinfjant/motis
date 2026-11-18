// The security headers every response gets (see start.ts). Kept apart from
// the middleware so the policy can be read, and tested, on its own.

/**
 * The Content-Security-Policy: everything from the site itself, nothing
 * from anywhere else. Scripts also need the response's nonce, which the
 * router puts on the few inline scripts it writes into each page (its data
 * for hydration); no other inline script can run, so injected markup can't
 * either.
 *
 * - Images may be data: URLs: drawn signatures are stored as PNG data URLs.
 * - Styles are our own stylesheets. Inline style attributes in markup are
 *   blocked (the app has none; styles set from scripts still work). In
 *   development Vite adds styles as inline <style> elements, so they are
 *   allowed there, as is its websocket for live reloading.
 * - No plugins, no <base> elsewhere, forms only to the site, and no other
 *   site may show the app in a frame (against clickjacking).
 */
export function contentSecurityPolicy(nonce: string, development = false) {
	const policy: Record<string, string[]> = {
		"default-src": ["'self'"],
		"script-src": ["'self'", `'nonce-${nonce}'`],
		"style-src": development ? ["'self'", "'unsafe-inline'"] : ["'self'"],
		"img-src": ["'self'", "data:"],
		"font-src": ["'self'"],
		"connect-src": development ? ["'self'", "ws:"] : ["'self'"],
		"object-src": ["'none'"],
		"base-uri": ["'self'"],
		"form-action": ["'self'"],
		"frame-ancestors": ["'none'"],
	};
	return Object.entries(policy)
		.map(([name, sources]) => `${name} ${sources.join(" ")}`)
		.join("; ");
}

/** The headers to set on every response, with this response's nonce. */
export function securityHeaders(
	nonce: string,
	development = false,
): Record<string, string> {
	return {
		"Content-Security-Policy": contentSecurityPolicy(nonce, development),
		// Files are what their Content-Type says, never guessed.
		"X-Content-Type-Options": "nosniff",
		// Links out of the app don't tell where they came from: addresses like
		// /justera/… and /protokoll/… are keys in themselves.
		"Referrer-Policy": "same-origin",
		// Older browsers' version of frame-ancestors.
		"X-Frame-Options": "DENY",
		// Windows the app opens, or that open it, can't reach into it.
		"Cross-Origin-Opener-Policy": "same-origin",
		// Pages load only what agrees to it: everything is the site's own, so
		// that's all of it. Together with the opener policy the page is
		// isolated from other sites' pages in the browser.
		"Cross-Origin-Embedder-Policy": "require-corp",
		// And other sites can't load the app's files (or responses) into theirs.
		"Cross-Origin-Resource-Policy": "same-origin",
		// Nothing the app doesn't use.
		"Permissions-Policy":
			"camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
		// Only over https from now on (a year). Not on localhost, where it
		// would stick to every other local project too.
		...(development ? {} : { "Strict-Transport-Security": "max-age=31536000" }),
	};
}
