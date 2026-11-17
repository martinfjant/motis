import type { ProtocolValue } from "#/server/items";
import type { TypeBlocks } from "../blocks";

/** The point's own wording for the answers, set in the template or agenda. */
export type AnswerTexts = { yesText?: string; noText?: string };

/**
 * Ja/nej ("toggle"): how an answer reads in the protocol: the point's own
 * text (e.g. "Dagordningen godkändes.") or else "Ja" / "Nej".
 */
export const answerText = (answer: boolean, texts: AnswerTexts = {}) =>
	answer ? texts.yesText || "Ja" : texts.noText || "Nej";

export const toggleBlocks: TypeBlocks = (v: ProtocolValue, _type, item) =>
	v.answer === undefined
		? []
		: [{ kind: "text", text: answerText(v.answer, item) }];
