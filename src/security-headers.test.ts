import { expect, test } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

test("the policy allows only the site itself, and scripts with the nonce", () => {
	const policy = contentSecurityPolicy("abc123");
	expect(policy).toContain("default-src 'self'");
	expect(policy).toContain("script-src 'self' 'nonce-abc123'");
	expect(policy).toContain("style-src 'self';");
	expect(policy).toContain("img-src 'self' data:");
	expect(policy).toContain("frame-ancestors 'none'");
	expect(policy).toContain("object-src 'none'");
	expect(policy).not.toContain("unsafe-inline");
	expect(policy).not.toContain("unsafe-eval");
});

test("development allows Vite's inline styles and websocket, not inline scripts", () => {
	const policy = contentSecurityPolicy("abc123", true);
	expect(policy).toContain("style-src 'self' 'unsafe-inline'");
	expect(policy).toContain("connect-src 'self' ws:");
	expect(policy).toContain("script-src 'self' 'nonce-abc123'");
});

test("HSTS only in production", () => {
	expect(securityHeaders("n")).toMatchObject({
		"Strict-Transport-Security": "max-age=31536000",
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
		"Cross-Origin-Opener-Policy": "same-origin",
		"Cross-Origin-Embedder-Policy": "require-corp",
		"Cross-Origin-Resource-Policy": "same-origin",
	});
	expect(securityHeaders("n", true)).not.toHaveProperty(
		"Strict-Transport-Security",
	);
});
