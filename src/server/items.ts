// Shared, client-safe definitions for agenda/template items.

export const ITEM_TYPES = [
	"toggle",
	"attendance",
	"person",
	"decision",
	"text",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
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
