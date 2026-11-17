import { MeetingTime } from "./DateTime";

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
						<MeetingTime at={meetingAt} />
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
