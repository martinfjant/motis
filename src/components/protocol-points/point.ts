import type {
	CarryOverFlags,
	ProtocolItem,
	ProtocolValue,
} from "#/server/items";

/** What every kind of point gets from ProtocolPoint. */
export type PointProps = {
	item: ProtocolItem;
	/**
	 * Dealt with: show what was recorded, with "Ändra". Otherwise show the
	 * form, with "Klar" (and "Bordlägg" where it applies).
	 */
	klar: boolean;
	/** Klar, then opened again with "Ändra": offers "Avbryt", not "Bordlägg". */
	reopened: boolean;
	/**
	 * Saves the point. With done (the default) the point becomes klar when
	 * the save succeeds; without, the form stays open (attendance ticks).
	 */
	save: (value: ProtocolValue, done?: boolean) => Promise<boolean>;
	/** "Ändra": open the form again. */
	edit: () => void;
	/** "Avbryt": back to klar without saving. */
	cancel: () => void;
	/** Tables the point or marks it for follow-up. */
	carryOver: (flags: CarryOverFlags) => Promise<boolean>;
	/** "Ta bort punkten" (asks first). */
	remove: () => void;
};

/** Whether anything has been recorded for the point yet (flags aside). */
export function hasValue(v: ProtocolValue) {
	const { tabled: _t, followUp: _f, ...recorded } = v;
	return Object.keys(recorded).length > 0;
}

/** Element ids unique to the point. */
export const fieldId = (item: ProtocolItem, name: string) =>
	`${item.id}-${name}`;

/** The notes field's value, "" when it was never opened. */
export const readNotes = (f: FormData) => String(f.get("notes") ?? "");
