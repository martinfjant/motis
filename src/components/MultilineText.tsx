import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode, useContext } from "react";
import { splitRefs } from "#/protocol-refs";
import { type Attachment, AttachmentLink, useAttachments } from "./Attachments";
import { ProtocolRefs } from "./ProtocolRefs";

/**
 * Blank lines separate paragraphs; single line breaks are kept. References
 * to other protocols ("#Styrelsemöte 12-11-2026") become links where the
 * page allows it (see ProtocolRefs), and stay text elsewhere; "Bilaga 2"
 * opens that attachment wherever the page has it.
 */
export function MultilineText({ text }: { text: string }) {
	const { links = [], boardId } = useContext(ProtocolRefs);
	const { attachments } = useAttachments();
	const linked = (line: string) =>
		(boardId ? splitRefs(line, links) : [line]).flatMap((part, k) =>
			typeof part === "string" ? (
				withAttachments(part, attachments, k)
			) : (
				<Link
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed parts of a line
					key={k}
					to="/styrelser/$boardId/protokoll/$protocolId"
					params={{ boardId: boardId ?? "", protocolId: part.id }}
				>
					{part.text}
				</Link>
			),
		);
	return text
		.split(/\n{2,}/)
		.filter((para) => para.trim())
		.map((para, i) => (
			// biome-ignore lint/suspicious/noArrayIndexKey: static text paragraphs
			<p key={i}>
				{para.split("\n").map((line, j) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static text lines
					<Fragment key={j}>
						{j > 0 && <br />}
						{linked(line)}
					</Fragment>
				))}
			</p>
		));
}

/**
 * "Bilaga 2" in a text opens that attachment, if the meeting has one with
 * that number (see Attachments).
 */
function withAttachments(
	text: string,
	attachments: Attachment[],
	key: number,
): ReactNode[] {
	if (attachments.length === 0 || !text.includes("Bilaga")) return [text];
	const byNumber = new Map(attachments.map((a) => [a.number, a]));
	const parts: ReactNode[] = [];
	let last = 0;
	for (const m of text.matchAll(/\bBilaga (\d+)\b/g)) {
		const attachment = byNumber.get(Number(m[1]));
		if (!attachment || m.index === undefined) continue;
		if (m.index > last) parts.push(text.slice(last, m.index));
		parts.push(
			<AttachmentLink key={`${key}-${m.index}`} attachment={attachment}>
				{m[0]}
			</AttachmentLink>,
		);
		last = m.index + m[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return parts;
}
