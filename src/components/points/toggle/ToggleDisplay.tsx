import type { RecordedItem } from "../shared/point";
import { answerText } from "./toggleText";

/** The answer, "Ja" or "Nej". */
export function ToggleDisplay({ item }: { item: RecordedItem }) {
	if (item.value.answer === undefined) return null;
	return <p>{answerText(item.value.answer)}</p>;
}
