import { useState } from "react";
import { Field } from "#/components/Field";
import { Form } from "#/components/Form";
import { MentionTextarea } from "#/components/MentionTextarea";
import { DoneView } from "../shared/DoneView";
import { NotesField } from "../shared/NotesField";
import { PointActions } from "../shared/PointActions";
import { fieldId, type PointProps, readNotes } from "../shared/point";
import { DECISION_LABEL } from "./decisionText";

/** Beslut ("decision"): the decision as it should read in the minutes. */
export function DecisionForm(props: PointProps) {
	const { item, done, save } = props;
	const v = item.value;
	const [notesOpen, setNotesOpen] = useState(!!v.notes);
	if (done) return <DoneView {...props} />;

	const id = fieldId(item, "decision");
	return (
		<Form
			onSubmit={(e) => {
				e.preventDefault();
				const f = new FormData(e.currentTarget);
				save({
					decision: String(f.get("decision") ?? ""),
					notes: readNotes(f),
				});
			}}
		>
			<Field id={id} label={DECISION_LABEL}>
				<MentionTextarea name="decision" defaultValue={v.decision} required />
			</Field>
			<NotesField
				item={item}
				open={notesOpen}
				onOpen={() => setNotesOpen(true)}
			/>
			<PointActions {...props} submit />
		</Form>
	);
}
