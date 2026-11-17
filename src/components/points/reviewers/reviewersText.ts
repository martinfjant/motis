import type { TypeBlocks } from "../blocks";

/** Val av justerare ("reviewers"): the label, and how two names are joined. */
export const REVIEWERS_LABEL = "Justerare";
export const REVIEWERS_JOIN = " och ";

export const reviewersBlocks: TypeBlocks = (v) =>
	v.reviewers?.length
		? [
				{
					kind: "value",
					label: REVIEWERS_LABEL,
					value: v.reviewers.map((r) => r.name).join(REVIEWERS_JOIN),
				},
			]
		: [];
