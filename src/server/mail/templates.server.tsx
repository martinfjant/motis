import { formatMeetingAt } from "../../meeting-time";
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

type ProtocolInfo = { title: string; meetingAt: string };

/** "Styrelsemöte 14-01-2027 18:00", or just the title without a date. */
const meetingName = (p: ProtocolInfo) =>
	p.meetingAt ? `${p.title} ${formatMeetingAt(p.meetingAt)}` : p.title;

/** Swedish genitive: "BRF Björkens", but "BRF Ekhus" stays as it is. */
const genitive = (name: string) => (/[sxz]$/i.test(name) ? name : `${name}s`);

const muted = { color: "#78716c", fontSize: "14px" };
const heading = { fontSize: "22px", margin: "0 0 12px" };

/** To a justerare: read the protocol and approve or decline it. */
export function reviewRequestMail(input: {
	to: string;
	name: string;
	senderName: string;
	boardName: string;
	protocol: ProtocolInfo;
	url: string;
	days: number;
}): Mail {
	const meeting = meetingName(input.protocol);
	const intro = `${input.senderName} har skickat protokollet från ${genitive(input.boardName)} möte ${meeting} till dig för justering.`;
	const ask =
		"Läs igenom protokollet och godkänn det, eller avvisa det och skriv vad som behöver ändras.";
	const personal = `Länken är personlig och fungerar i ${input.days} dagar. Skicka inte vidare mejlet.`;
	return {
		to: input.to,
		subject: `Justera protokollet: ${meeting} – ${input.boardName}`,
		html: renderEmail(
			<>
				<h1 style={heading}>Protokoll att justera</h1>
				<p>Hej {input.name}!</p>
				<p>{intro}</p>
				<p>{ask}</p>
				<EmailButton href={input.url}>Läs och justera protokollet</EmailButton>
				<p style={muted}>{personal}</p>
				<p style={muted}>
					Fungerar inte knappen? Kopiera adressen: {input.url}
				</p>
			</>,
		),
		text: [
			`Hej ${input.name}!`,
			"",
			intro,
			ask,
			"",
			`Läs och justera protokollet: ${input.url}`,
			"",
			personal,
		].join("\n"),
	};
}

/** To whoever sent the protocol: a justerare declined it. */
export function reviewDecidedMail(input: {
	to: string;
	boardName: string;
	protocol: ProtocolInfo;
	url: string;
	reviewerName: string;
	comment: string;
}): Mail {
	const meeting = meetingName(input.protocol);
	const intro = `${input.reviewerName} har avvisat protokollet från ${genitive(input.boardName)} möte ${meeting}:`;
	const next =
		"Redigera protokollet och skicka det för justering igen när det är rättat.";
	return {
		to: input.to,
		subject: `Protokollet avvisades: ${meeting} – ${input.boardName}`,
		html: renderEmail(
			<>
				<h1 style={heading}>Protokollet avvisades</h1>
				<p>{intro}</p>
				<blockquote
					style={{
						margin: "12px 0",
						padding: "8px 12px",
						borderLeft: "4px solid #d6d3d1",
						whiteSpace: "pre-wrap",
					}}
				>
					{input.comment}
				</blockquote>
				<p>{next}</p>
				<EmailButton href={input.url}>Till protokollet</EmailButton>
			</>,
		),
		text: [
			intro,
			"",
			input.comment,
			"",
			next,
			"",
			`Till protokollet: ${input.url}`,
		].join("\n"),
	};
}

/** To whoever sent the protocol: every justerare has approved it. */
export function reviewDoneMail(input: {
	to: string;
	boardName: string;
	protocol: ProtocolInfo;
	url: string;
	reviewers: string[];
}): Mail {
	const meeting = meetingName(input.protocol);
	const done = `Protokollet från ${genitive(input.boardName)} möte ${meeting} är justerat av ${input.reviewers.join(" och ")}.`;
	return {
		to: input.to,
		subject: `Protokollet är justerat: ${meeting} – ${input.boardName}`,
		html: renderEmail(
			<>
				<h1 style={heading}>Protokollet är justerat</h1>
				<p>{done}</p>
				<EmailButton href={input.url}>Till protokollet</EmailButton>
			</>,
		),
		text: [done, "", `Till protokollet: ${input.url}`].join("\n"),
	};
}

/** After signing up or changing address: confirm that the address is yours. */
export function verifyEmailMail(input: {
	to: string;
	name: string;
	url: string;
	hours: number;
}): Mail {
	const intro =
		"Bekräfta att det är din e-postadress, så att din styrelse kan nå dig och du kan återställa lösenordet om du glömmer det.";
	const notYou = `Länken fungerar i ${input.hours} timmar. Har du inte skapat något konto kan du strunta i det här mejlet.`;
	return {
		to: input.to,
		subject: "Bekräfta din e-postadress",
		html: renderEmail(
			<>
				<h1 style={heading}>Bekräfta din e-postadress</h1>
				<p>Hej {input.name}!</p>
				<p>{intro}</p>
				<EmailButton href={input.url}>Bekräfta e-postadressen</EmailButton>
				<p style={muted}>{notYou}</p>
				<p style={muted}>
					Fungerar inte knappen? Kopiera adressen: {input.url}
				</p>
			</>,
		),
		text: [
			`Hej ${input.name}!`,
			"",
			intro,
			"",
			`Bekräfta e-postadressen: ${input.url}`,
			"",
			notYou,
		].join("\n"),
	};
}

/** "Glömt lösenordet": a link for setting a new password. */
export function passwordResetMail(input: {
	to: string;
	name: string;
	url: string;
	minutes: number;
}): Mail {
	const intro = "Någon, förhoppningsvis du, har bett om att få byta lösenord.";
	const notYou = `Länken fungerar i ${input.minutes} minuter och bara en gång. Har du inte bett om det kan du strunta i det här mejlet; ditt lösenord är oförändrat.`;
	return {
		to: input.to,
		subject: "Välj ett nytt lösenord",
		html: renderEmail(
			<>
				<h1 style={heading}>Välj ett nytt lösenord</h1>
				<p>Hej {input.name}!</p>
				<p>{intro}</p>
				<EmailButton href={input.url}>Välj nytt lösenord</EmailButton>
				<p style={muted}>{notYou}</p>
				<p style={muted}>
					Fungerar inte knappen? Kopiera adressen: {input.url}
				</p>
			</>,
		),
		text: [
			`Hej ${input.name}!`,
			"",
			intro,
			"",
			`Välj nytt lösenord: ${input.url}`,
			"",
			notYou,
		].join("\n"),
	};
}
