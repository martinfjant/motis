import type { TypeBlocks } from "../blocks";

/** Val av person ("person"): the label for who was chosen. */
export const PERSON_LABEL = "Mötet väljer";

export const personBlocks: TypeBlocks = (v) =>
	v.person ? [{ kind: "value", label: PERSON_LABEL, value: v.person }] : [];
