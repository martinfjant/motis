// Shared, client-safe definitions for agenda/template items.

export const ITEM_TYPES = [
	"open",
	"close",
	"toggle",
	"attendance",
	"person",
	"decision",
	"text",
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
};

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
	/** toggle: e.g. the agenda was approved. */
	done?: boolean;
	/** open/close: when it happened, local wall-clock "YYYY-MM-DDTHH:MM". */
	at?: string;
	/** attendance: names of everyone present (snapshot, not account ids). */
	present?: string[];
	/** person: the chosen person's name. */
	person?: string;
	/** decision: the decision as it should read in the minutes. */
	decision?: string;
	/** All types: free-form minutes for the point. */
	notes?: string;
};

export type ProtocolItem = Item & { value: ProtocolValue };
