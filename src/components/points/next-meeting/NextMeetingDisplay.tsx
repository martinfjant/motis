import { MeetingTime } from "#/components/DateTime";
import type { RecordedItem } from "../shared/point";
import { NEXT_MEETING_LABEL } from "./nextMeetingText";

/** When the next meeting is. */
export function NextMeetingDisplay({ item }: { item: RecordedItem }) {
	if (!item.value.at) return null;
	return (
		<p>
			{NEXT_MEETING_LABEL}: <MeetingTime at={item.value.at} />
		</p>
	);
}
