import { Link } from "@tanstack/react-router";
import { Fragment, useContext } from "react";
import { splitRefs } from "#/protocol-refs";
import { ProtocolRefs } from "./ProtocolRefs";

/**
 * Blank lines separate paragraphs; single line breaks are kept. References
 * to other protocols ("#Styrelsemöte 12-11-2026") become links where the
 * page allows it (see ProtocolRefs), and stay text elsewhere.
 */
export function MultilineText({ text }: { text: string }) {
	const { links = [], boardId } = useContext(ProtocolRefs);
	const linked = (line: string) =>
		boardId
			? splitRefs(line, links).map((part, k) =>
					typeof part === "string" ? (
						part
					) : (
						<Link
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed parts of a line
							key={k}
							to="/styrelser/$boardId/protokoll/$protocolId"
							params={{ boardId, protocolId: part.id }}
						>
							{part.text}
						</Link>
					),
				)
			: line;
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
