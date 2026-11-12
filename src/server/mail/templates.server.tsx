import { EmailButton, renderEmail } from "./layout.server";
import { appUrl, type Mail } from "./send.server";

// Every email the app sends, each with its HTML and plain-text version.

/** A sample, sent from the development outbox to see how emails look. */
export function testMail(user: { name: string; email: string }): Mail {
	const url = appUrl("/");
	return {
		to: user.email,
		subject: "Testmejl från BRF-protokoll",
		html: renderEmail(
			<>
				<h1 style={{ fontSize: "22px", margin: "0 0 12px" }}>
					Hej {user.name}!
				</h1>
				<p>Så här ser mejlen från BRF-protokoll ut.</p>
				<EmailButton href={url}>Till Mina föreningar</EmailButton>
				<p style={{ color: "#78716c", fontSize: "14px" }}>
					Fungerar inte knappen? Kopiera adressen: {url}
				</p>
			</>,
		),
		text: [
			`Hej ${user.name}!`,
			"",
			"Så här ser mejlen från BRF-protokoll ut.",
			"",
			`Till Mina föreningar: ${url}`,
		].join("\n"),
	};
}
