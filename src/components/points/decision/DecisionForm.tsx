import { useState } from "react";
import { Button } from "#/components/Button";
import { Checkbox } from "#/components/Choice";
import { Field } from "#/components/Field";
import { Form } from "#/components/Form";
import { MentionTextarea } from "#/components/MentionTextarea";
import { DoneView } from "../shared/DoneView";
import { NotesField } from "../shared/NotesField";
import { PointActions } from "../shared/PointActions";
import { fieldId, type PointProps, readNotes } from "../shared/point";
import { DECISION_LABEL } from "./decisionText";

/**
 * Beslut ("decision"): the decision as it should read in the minutes, and
 * anyone present who reserves themselves against it (behind "Reservation…",
 * since it is rare).
 */
export function DecisionForm(props: PointProps & { present?: string[] }) {
	const { item, done, save, present = [] } = props;
	const v = item.value;
	const [notesOpen, setNotesOpen] = useState(!!v.notes);
	const [reservationsOpen, setReservationsOpen] = useState(
		!!v.reservations?.length,
	);
	if (done) return <DoneView {...props} />;

	const id = fieldId(item, "decision");
	return (
		<Form
			onSubmit={(e) => {
				e.preventDefault();
				const f = new FormData(e.currentTarget);
				save({
					decision: String(f.get("decision") ?? ""),
					reservations: f.getAll("reservations").map(String),
					notes: readNotes(f),
				});
			}}
		>
			<Field id={id} label={DECISION_LABEL}>
				<MentionTextarea name="decision" defaultValue={v.decision} required />
			</Field>
			{reservationsOpen ? (
				<fieldset className="space-y-2.5">
					<legend className="pb-2">Reserverade sig mot beslutet</legend>
					{present.length === 0 ? (
						<p>
							Den som reserverar sig väljs bland de närvarande. Markera först
							vilka som är närvarande.
						</p>
					) : (
						present.map((name) => (
							<Checkbox
								key={name}
								id={fieldId(item, `reservation-${name}`)}
								label={name}
								name="reservations"
								value={name}
								defaultChecked={v.reservations?.includes(name)}
							/>
						))
					)}
				</fieldset>
			) : (
				<p>
					<Button icon="user-minus" onClick={() => setReservationsOpen(true)}>
						Reservation…
					</Button>
				</p>
			)}
			<NotesField
				item={item}
				open={notesOpen}
				onOpen={() => setNotesOpen(true)}
			/>
			<PointActions {...props} submit />
		</Form>
	);
}
