// Shared, client-safe definitions for agenda/template items.

export const ITEM_TYPES = [
	"open",
	"close",
	"toggle",
	"attendance",
	"person",
	"decision",
	"text",
	"next_meeting",
	"reviewers",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
	open: "Mötets öppnande (med tidpunkt)",
	close: "Mötets avslutande (med tidpunkt)",
	toggle: "Ja/nej (t.ex. mötet öppnat)",
	attendance: "Närvaro",
	person: "Val av person",
	decision: "Beslut",
	text: "Fritext",
	next_meeting: "Nästa möte (datum och tid)",
	reviewers: "Val av justerare (bland de närvarande)",
};

/**
 * Points that are matters to discuss, as opposed to formalities like opening
 * the meeting or taking attendance. Only these can be tabled ("bordläggas")
 * or marked for follow-up, which carries them over to the next meeting.
 */
export function canCarryOver(type: ItemType): boolean {
	return type === "text" || type === "decision";
}

export type Item = {
	id: string;
	position: number;
	title: string;
	type: ItemType;
	description: string;
	/** Only used by attendance items: people who are not board members. */
	extraNames: string[];
	/** Only used by reviewers items: how many justerare, 1 or 2. */
	reviewerCount: ReviewerCount;
};

export type ReviewerCount = 1 | 2;
export const DEFAULT_REVIEWER_COUNT: ReviewerCount = 2;

export function toReviewerCount(v: unknown): ReviewerCount {
	return Number(v) === 1 ? 1 : 2;
}

/**
 * A board member as a reference that survives name and title changes:
 * "user:<id>" for members with an account, "unregistered:<id>" for those
 * without. Used to find a justerare's email address.
 */
export type MemberRef = `user:${string}` | `unregistered:${string}`;

/**
 * A chosen justerare: the name as written in the protocol, and who it is
 * (always stored; left out of public views).
 */
export type Reviewer = { name: string; member?: MemberRef };

/** A board member who can be chosen as justerare, if present at the meeting. */
export type ReviewerCandidate = {
	member: MemberRef;
	/** As written in the protocol, "Namn (Titel)", the same as in attendance. */
	label: string;
	/** Whether there is an address to send the protocol to. */
	hasEmail: boolean;
};

export function isItemType(v: unknown): v is ItemType {
	return (ITEM_TYPES as readonly unknown[]).includes(v);
}

/** What was recorded for a point at the meeting. Which fields apply depends on the type. */
export type ProtocolValue = {
	/**
	 * Dealt with: "Klar" was pressed, or the point was settled by a choice.
	 * Not set on tabled points, which were not dealt with.
	 */
	done?: boolean;
	/** toggle: the answer, e.g. whether the agenda was approved. */
	answer?: boolean;
	/**
	 * open/close: when it happened; next_meeting: when the next meeting is.
	 * Local wall-clock "YYYY-MM-DDTHH:MM".
	 */
	at?: string;
	/** attendance: names of everyone present (snapshot, not account ids). */
	present?: string[];
	/** person: the chosen person's name. */
	person?: string;
	/**
	 * reviewers: the chosen justerare, as many as the point asks for, all
	 * among those present.
	 */
	reviewers?: Reviewer[];
	/** decision: the decision as it should read in the minutes. */
	decision?: string;
	/** All types: free-form minutes for the point. */
	notes?: string;
	/** Tabled ("bordlagd"): not dealt with, moved to the next meeting. */
	tabled?: boolean;
	/** Dealt with, but to be followed up at the next meeting. */
	followUp?: boolean;
};

/**
 * Where a point is at the meeting: still to be dealt with ("open"), dealt
 * with ("done") or moved to the next meeting ("tabled").
 */
export type PointState = "open" | "done" | "tabled";

export function pointState(v: ProtocolValue): PointState {
	if (v.tabled) return "tabled";
	if (v.done) return "done";
	return "open";
}

/** The flags that carry a point over to the next meeting. */
export type CarryOverFlags = Pick<ProtocolValue, "tabled" | "followUp">;

export type ProtocolItem = Item & { value: ProtocolValue };

/**
 * How a board member is written in protocols: "Namn Namnsson (Sekreterare)",
 * or just the name if they have no title.
 */
export function personLabel(name: string, title: string): string {
	return title ? `${name} (${title})` : name;
}

/** A change made after a protocol was closed: who (as written) and when (UTC). */
export type ProtocolEdit = { userName: string; editedAt: string };
