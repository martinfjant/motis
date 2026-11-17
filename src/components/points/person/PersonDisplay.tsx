import type { RecordedItem } from "../shared/point";
import { PERSON_LABEL } from "./personText";

/** Who was chosen. */
export function PersonDisplay({ item }: { item: RecordedItem }) {
	if (!item.value.person) return null;
	return (
		<p>
			{PERSON_LABEL}: <strong>{item.value.person}</strong>
		</p>
	);
}
