import { MultilineText } from "#/components/MultilineText";
import type { RecordedItem } from "../shared/point";
import { DECISION_LABEL, reservationText } from "./decisionText";

/**
 * The decision, quoted as it should read in the minutes, and who reserved
 * themselves against it.
 */
export function DecisionDisplay({ item }: { item: RecordedItem }) {
	const { decision, reservations } = item.value;
	return (
		<>
			{decision && (
				<>
					<p>{DECISION_LABEL}:</p>
					<blockquote>
						<MultilineText text={decision} />
					</blockquote>
				</>
			)}
			{reservations?.length ? (
				<p>
					<strong>Reservation:</strong> {reservationText(reservations)}
				</p>
			) : null}
		</>
	);
}
