import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Emails are rendered from React to plain HTML. Email programs ignore
// stylesheets and classes, so the styling is inline and kept simple; the
// plain-text version of each email is written alongside its HTML.

/** The finished HTML document for an email body. */
export function renderEmail(body: ReactNode): string {
	return `<!doctype html>${renderToStaticMarkup(
		<html lang="sv">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</head>
			<body
				style={{
					margin: 0,
					padding: "24px 12px",
					background: "#f5f5f4",
					color: "#1c1917",
					fontFamily:
						"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
					fontSize: "16px",
					lineHeight: 1.5,
				}}
			>
				<main
					style={{
						maxWidth: "600px",
						margin: "0 auto",
						padding: "24px",
						background: "#ffffff",
						borderRadius: "12px",
					}}
				>
					{body}
				</main>
				<p
					style={{
						maxWidth: "600px",
						margin: "12px auto 0",
						color: "#78716c",
						fontSize: "13px",
						textAlign: "center",
					}}
				>
					Skickat från BRF-protokoll.
				</p>
			</body>
		</html>,
	)}`;
}

/** A link that looks like a button, for the one thing the email asks for. */
export function EmailButton({
	href,
	children,
}: {
	href: string;
	children: ReactNode;
}) {
	return (
		<p style={{ margin: "24px 0" }}>
			<a
				href={href}
				style={{
					display: "inline-block",
					padding: "10px 18px",
					background: "#0284c7",
					color: "#ffffff",
					borderRadius: "8px",
					textDecoration: "none",
					fontWeight: 600,
				}}
			>
				{children}
			</a>
		</p>
	);
}
