import { useState } from "react";
import { Field, Input } from "#/components/Field";
import { DoneView } from "./DoneView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { fieldId, type PointProps, readNotes } from "./point";

/** Nästa möte ("next_meeting"): when the next meeting is. */
export function NextMeetingPoint(props: PointProps) {
	const { item, done, save } = props;
	const [notesOpen, setNotesOpen] = useState(!!item.value.notes);
	if (done) return <DoneView {...props} />;

	const id = fieldId(item, "at");
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				const f = new FormData(e.currentTarget);
				save({ at: String(f.get("at") ?? ""), notes: readNotes(f) });
			}}
		>
			<Field id={id} label="Datum och tid">
				<Input
					name="at"
					type="datetime-local"
					defaultValue={item.value.at}
					required
				/>
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
