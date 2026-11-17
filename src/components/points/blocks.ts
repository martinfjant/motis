import type { ItemType, ProtocolValue } from "#/server/items";
import { attendanceBlocks } from "./attendance/attendanceText";
import { decisionBlocks } from "./decision/decisionText";
import { momentBlocks } from "./moment/momentText";
import { nextMeetingBlocks } from "./next-meeting/nextMeetingText";
import { personBlocks } from "./person/personText";
import { reviewersBlocks } from "./reviewers/reviewersText";
import { textBlocks } from "./text/textText";
import { toggleBlocks } from "./toggle/toggleText";

// What was recorded for a point as plain pieces, for the downloads (Markdown
// and PDF). Says the same as RecordedValue on the protocol page, using the
// wording in each type's <type>Text.ts. Kept free of React and server code,
// so both the server and the components can import it.

/** What was recorded for a point, as plain pieces any format can render. */
export type Block =
	/** A paragraph; blank lines inside separate paragraphs. */
	| { kind: "text"; text: string }
	/** "Vald: Anna" with the value emphasised. */
	| { kind: "value"; label: string; value: string }
	| { kind: "list"; label: string; items: string[] }
	| { kind: "quote"; label: string; text: string };

/** One type's own part: what is shown between "tabled" and the notes. */
export type TypeBlocks = (v: ProtocolValue, type: ItemType) => Block[];

export const FOLLOW_UP_TEXT = "Kommer följas upp på nästa möte.";

const BLOCKS: Record<ItemType, TypeBlocks> = {
	open: momentBlocks,
	close: momentBlocks,
	toggle: toggleBlocks,
	attendance: attendanceBlocks,
	person: personBlocks,
	reviewers: reviewersBlocks,
	decision: decisionBlocks,
	next_meeting: nextMeetingBlocks,
	text: textBlocks,
};

export function recordedBlocks(type: ItemType, v: ProtocolValue): Block[] {
	return [
		...(v.tabled
			? [{ kind: "text", text: "Bordlagd till nästa möte." } as const]
			: []),
		...BLOCKS[type](v, type),
		...(v.notes ? [{ kind: "text", text: v.notes } as const] : []),
		...(v.followUp ? [{ kind: "text", text: FOLLOW_UP_TEXT } as const] : []),
	];
}
