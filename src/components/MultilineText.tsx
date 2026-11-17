import { Fragment } from "react";

/** Blank lines separate paragraphs; single line breaks are kept. */
export function MultilineText({ text }: { text: string }) {
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
						{line}
					</Fragment>
				))}
			</p>
		));
}
