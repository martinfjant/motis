import type { TypeBlocks } from "../blocks";

/** Ja/nej ("toggle"): how an answer reads. */
export const answerText = (answer: boolean) => (answer ? "Ja" : "Nej");

export const toggleBlocks: TypeBlocks = (v) =>
	v.answer === undefined ? [] : [{ kind: "text", text: answerText(v.answer) }];
