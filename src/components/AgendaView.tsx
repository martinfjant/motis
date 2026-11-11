import { Fragment } from "react";
import { formatMeetingAt } from "#/meeting-time";

/** Time and place as a description list; renders nothing if both are empty. */
export function MeetingDetails({
	meetingAt,
	location,
}: {
	meetingAt: string;
	location: string;
}) {
	if (!meetingAt && !location) return null;
	return (
		<dl>
			{meetingAt && (
				<>
					<dt>Tid</dt>
					<dd>
						<time dateTime={meetingAt}>{formatMeetingAt(meetingAt)}</time>
					</dd>
				</>
			)}
			{location && (
				<>
					<dt>Plats</dt>
					<dd>{location}</dd>
				</>
			)}
		</dl>
	);
}

/** The agenda's points as a numbered list, read-only. */
export function AgendaItems({
	items,
	headingLevel,
}: {
	items: { id: string; title: string; description: string }[];
	headingLevel: 2 | 3;
}) {
	const Heading = headingLevel === 2 ? "h2" : "h3";
	if (items.length === 0) return <p>Dagordningen har inga punkter ännu.</p>;
	return (
		<ol>
			{items.map((item) => (
				<li key={item.id}>
					<Heading>{item.title}</Heading>
					<MultilineText text={item.description} />
				</li>
			))}
		</ol>
	);
}

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
