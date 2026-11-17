import type { TypeBlocks } from "../blocks";

/** Beslut ("decision"): the label for the decision. */
export const DECISION_LABEL = "Beslut";

export const decisionBlocks: TypeBlocks = (v) =>
	v.decision
		? [{ kind: "quote", label: `${DECISION_LABEL}:`, text: v.decision }]
		: [];
