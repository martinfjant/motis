import { formatInstant } from "../../meeting-time";
import {
	type Block,
	historyLines,
	meetingLines,
	type ProtocolDocument,
} from "./document.server";

// The protocol as Markdown. What people wrote is escaped, so a note that
// starts with "#" or contains "*" reads as written, not as formatting.

/** Escapes text so it shows as written; line breaks are kept. */
export function escapeMarkdown(text: string): string {
	return text
		.split("\n")
		.map((line) =>
			line
				.replace(/([\\`*_[\]<>|])/g, "\\$1")
				// What would start a heading, quote, list or numbered list.
				.replace(/^(\s*)([#>+-])/, "$1\\$2")
				.replace(/^(\s*\d+)\./, "$1\\."),
		)
		.join("  \n");
}

/** Paragraphs separated by blank lines, line breaks within them kept. */
function paragraphs(text: string): string {
	return text
		.split(/\n{2,}/)
		.filter((p) => p.trim())
		.map((p) => escapeMarkdown(p.trim()))
		.join("\n\n");
}

function block(b: Block): string {
	switch (b.kind) {
		case "text":
			return paragraphs(b.text);
		case "value":
			return `${b.label}: **${escapeMarkdown(b.value)}**`;
		case "list":
			return [
				escapeMarkdown(b.label),
				"",
				...b.items.map((i) => `- ${escapeMarkdown(i)}`),
			].join("\n");
		case "quote":
			return [
				escapeMarkdown(b.label),
				"",
				...paragraphs(b.text)
					.split("\n")
					.map((line) => (line ? `> ${line}` : ">")),
			].join("\n");
	}
}

export function protocolMarkdown(doc: ProtocolDocument): string {
	const parts: string[] = [
		`# Protokoll: ${escapeMarkdown(doc.title)}`,
		escapeMarkdown(doc.boardName),
	];
	const details = meetingLines(doc);
	if (details.length)
		parts.push(
			details
				.map((d) => `- **${d.label}:** ${escapeMarkdown(d.value)}`)
				.join("\n"),
		);

	parts.push("## Punkter");
	doc.points.forEach((point, i) => {
		parts.push(`### ${i + 1}. ${escapeMarkdown(point.title)}`);
		if (point.description.trim()) parts.push(paragraphs(point.description));
		for (const b of point.blocks) parts.push(block(b));
	});

	parts.push(
		"## Historik",
		historyLines(doc)
			.map((l) => `- ${l}`)
			.join("\n"),
	);

	if (doc.justering)
		parts.push(
			"## Justering",
			"Protokollet är justerat av:",
			doc.justering.reviewers
				.map(
					(r) =>
						`- ${escapeMarkdown(r.name)}, ${r.signature ? "signerat digitalt" : "godkänt"} ${formatInstant(r.approvedAt)}`,
				)
				.join("\n"),
		);
	return `${parts.join("\n\n")}\n`;
}
