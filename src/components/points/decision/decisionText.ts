import type { TypeBlocks } from "../blocks";

/** Beslut ("decision"): the label for the decision. */
export const DECISION_LABEL = "Beslut";

/** "Anna", "Anna och Bo", "Anna, Bo och Cia". */
export function listNames(names: string[]): string {
	return names.length < 2
		? (names[0] ?? "")
		: `${names.slice(0, -1).join(", ")} och ${names.at(-1)}`;
}

/** "Anna och Bo reserverade sig mot beslutet." */
export function reservationText(names: string[]): string {
	return `${listNames(names)} reserverade sig mot beslutet.`;
}

export const decisionBlocks: TypeBlocks = (v) => [
	...(v.decision
		? [
				{
					kind: "quote",
					label: `${DECISION_LABEL}:`,
					text: v.decision,
				} as const,
			]
		: []),
	...(v.reservations?.length
		? [{ kind: "text", text: reservationText(v.reservations) } as const]
		: []),
];
