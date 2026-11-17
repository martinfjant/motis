import type { RecordedItem } from "../shared/point";
import { REVIEWERS_JOIN, REVIEWERS_LABEL } from "./reviewersText";

/** Who was chosen as justerare. */
export function ReviewersDisplay({ item }: { item: RecordedItem }) {
	const reviewers = item.value.reviewers ?? [];
	if (reviewers.length === 0) return null;
	return (
		<p>
			{REVIEWERS_LABEL}:{" "}
			{reviewers.map((r, i) => (
				<span key={r.name}>
					{i > 0 && REVIEWERS_JOIN}
					<strong>{r.name}</strong>
				</span>
			))}
		</p>
	);
}
