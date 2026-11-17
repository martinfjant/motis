import { MultilineText } from "#/components/MultilineText";
import type { RecordedItem } from "../shared/point";
import { DECISION_LABEL } from "./decisionText";

/** The decision, quoted as it should read in the minutes. */
export function DecisionDisplay({ item }: { item: RecordedItem }) {
	if (!item.value.decision) return null;
	return (
		<>
			<p>{DECISION_LABEL}:</p>
			<blockquote>
				<MultilineText text={item.value.decision} />
			</blockquote>
		</>
	);
}
