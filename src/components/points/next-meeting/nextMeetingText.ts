import { formatMeetingAt } from "#/meeting-time";
import type { TypeBlocks } from "../blocks";

/** Nästa möte ("next_meeting"): the label for when it is. */
export const NEXT_MEETING_LABEL = "Nästa möte";

export const nextMeetingBlocks: TypeBlocks = (v) =>
	v.at
		? [
				{
					kind: "value",
					label: NEXT_MEETING_LABEL,
					value: formatMeetingAt(v.at),
				},
			]
		: [];
