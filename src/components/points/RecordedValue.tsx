import type { ComponentType } from "react";
import { MultilineText } from "#/components/MultilineText";
import type { ItemType } from "#/server/items";
import { AttendanceDisplay } from "./attendance/AttendanceDisplay";
import { FOLLOW_UP_TEXT } from "./blocks";
import { DecisionDisplay } from "./decision/DecisionDisplay";
import { MomentDisplay } from "./moment/MomentDisplay";
import { NextMeetingDisplay } from "./next-meeting/NextMeetingDisplay";
import { PersonDisplay } from "./person/PersonDisplay";
import { ReviewersDisplay } from "./reviewers/ReviewersDisplay";
import type { RecordedItem } from "./shared/point";
import { TextDisplay } from "./text/TextDisplay";
import { ToggleDisplay } from "./toggle/ToggleDisplay";

const DISPLAYS: Record<ItemType, ComponentType<{ item: RecordedItem }>> = {
	open: MomentDisplay,
	close: MomentDisplay,
	toggle: ToggleDisplay,
	attendance: AttendanceDisplay,
	person: PersonDisplay,
	reviewers: ReviewersDisplay,
	decision: DecisionDisplay,
	next_meeting: NextMeetingDisplay,
	text: TextDisplay,
};

/**
 * What was recorded for one point, as text: on the finished protocol (in the
 * app, the public page and justering) and for done points during the
 * meeting. The downloads say the same through recordedBlocks.
 */
export function RecordedValue({ item }: { item: RecordedItem }) {
	const v = item.value;
	const Display = DISPLAYS[item.type];
	return (
		<>
			{v.tabled && (
				<p>
					<strong>Bordlagd</strong> till nästa möte.
				</p>
			)}
			<Display item={item} />
			{v.notes && <MultilineText text={v.notes} />}
			{v.followUp && <p>{FOLLOW_UP_TEXT}</p>}
		</>
	);
}
