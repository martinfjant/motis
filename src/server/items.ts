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
	/** decision: the decision as it should read in the minutes. */
	decision?: string;
	/** All types: free-form minutes for the point. */
	notes?: string;
	/** Tabled ("bordlagd"): not dealt with, moved to the next meeting. */
	tabled?: boolean;
	/** Dealt with, but to be followed up at the next meeting. */
	followUp?: boolean;
};

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
