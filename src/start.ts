import {
	createCsrfMiddleware,
	createMiddleware,
	createStart,
} from "@tanstack/react-start";
import { securityHeaders } from "./security-headers";

/**
 * Gives every response the security headers (see security-headers.ts),
 * with a new nonce each time. The nonce goes into the request context, where
 * the router (router.tsx) picks it up for the inline scripts it writes.
 */
const securityHeadersMiddleware = createMiddleware().server(
	async ({ next }) => {
		const nonce = Buffer.from(
			crypto.getRandomValues(new Uint8Array(16)),
		).toString("base64");
		const result = await next({ context: { nonce } });
		const headers = securityHeaders(
			nonce,
			process.env.NODE_ENV !== "production",
		);
		// A response may set its own (e.g. downloads' Referrer-Policy).
		for (const [name, value] of Object.entries(headers))
			if (!result.response.headers.has(name))
				result.response.headers.set(name, value);
		return result;
	},
);

/**
 * Refuses changes (anything but GET and HEAD, e.g. every server function
 * that saves) unless they come from the app's own pages. Browsers say where
 * a request comes from in Sec-Fetch-Site; older ones in Origin, which may
 * then be the site's address (APP_URL) or the one the request came in on.
 * The session cookie's SameSite=Lax already keeps other sites' requests
 * from being logged in; this is a second lock. Links into the app (GET),
 * e.g. from emails, are not affected.
 */
const csrfMiddleware = createCsrfMiddleware({
	filter: ({ request }) =>
		request.method !== "GET" && request.method !== "HEAD",
	// Runs on the server only (this file is bundled for the browser too, so
	// it reads APP_URL itself rather than importing the server's settings).
	origin: (origin, { request }) => {
		const appUrl = globalThis.process?.env.APP_URL;
		return (
			origin === new URL(request.url).origin ||
			(!!appUrl && URL.canParse(appUrl) && origin === new URL(appUrl).origin)
		);
	},
	failureResponse: new Response(
		"Ändringar kan bara göras från Mötis egna sidor.",
		{
			status: 403,
		},
	),
});

export const startInstance = createStart(() => ({
	requestMiddleware: [securityHeadersMiddleware, csrfMiddleware],
}));
