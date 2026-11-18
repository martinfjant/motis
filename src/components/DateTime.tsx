import { daysUntilText, formatInstant, formatMeetingAt } from "#/meeting-time";

/**
 * A meeting time ("20-11-2026 18:00"), with "(om 3 dagar)" after it when
 * daysUntil is given and the meeting is today or later.
 */
export function MeetingTime({
	at,
	daysUntil,
}: {
	/** Local wall-clock "YYYY-MM-DDTHH:MM". */
	at: string;
	daysUntil?: number;
}) {
	return (
		<>
			<time dateTime={at} className="whitespace-nowrap">
				{formatMeetingAt(at)}
			</time>
			{daysUntil !== undefined && daysUntil >= 0 && (
				<> ({daysUntilText(daysUntil)})</>
			)}
		</>
	);
}

/** When something happened, e.g. a protocol was closed, in Swedish time. */
export function Instant({ at }: { /** ISO 8601 UTC. */ at: string }) {
	return (
		// A date and time are never split over two lines.
		<time dateTime={at} className="whitespace-nowrap">
			{formatInstant(at)}
		</time>
	);
}
