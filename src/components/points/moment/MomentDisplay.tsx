import { MeetingTime } from "#/components/DateTime";
import type { RecordedItem } from "../shared/point";
import { momentText } from "./momentText";

/** When the meeting was opened or closed. */
export function MomentDisplay({ item }: { item: RecordedItem }) {
	if (!item.value.at) return null;
	return (
		<p>
			{momentText(item.type).done} <MeetingTime at={item.value.at} />
		</p>
	);
}
