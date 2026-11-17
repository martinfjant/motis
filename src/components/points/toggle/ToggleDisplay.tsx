import type { RecordedItem } from "../shared/point";
import { answerText } from "./toggleText";

/** The answer, in the point's own words (or "Ja" / "Nej"). */
export function ToggleDisplay({ item }: { item: RecordedItem }) {
	if (item.value.answer === undefined) return null;
	return <p>{answerText(item.value.answer, item)}</p>;
}
