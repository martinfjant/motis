import { useState } from "react";
import { Field } from "#/components/Field";
import { MentionTextarea } from "../MentionTextarea";
import { DoneView } from "./DoneView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { fieldId, type PointProps, readNotes } from "./point";

/** Beslut ("decision"): the decision as it should read in the minutes. */
export function DecisionPoint(props: PointProps) {
	const { item, done, save } = props;
	const v = item.value;
	const [notesOpen, setNotesOpen] = useState(!!v.notes);
	if (done) return <DoneView {...props} />;

	const id = fieldId(item, "decision");
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				const f = new FormData(e.currentTarget);
				save({
					decision: String(f.get("decision") ?? ""),
					notes: readNotes(f),
				});
			}}
		>
			<Field id={id} label="Beslut">
				<MentionTextarea name="decision" defaultValue={v.decision} required />
			</Field>
			<NotesField
				item={item}
				open={notesOpen}
				onOpen={() => setNotesOpen(true)}
			/>
			<PointActions {...props} submit />
		</form>
	);
}
