import { useState } from "react";
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
			<p>
				<label htmlFor={id}>Datum och tid</label>
				<input
					id={id}
					name="at"
					type="datetime-local"
					defaultValue={item.value.at}
					required
				/>
			</p>
			<NotesField
				item={item}
				open={notesOpen}
				onOpen={() => setNotesOpen(true)}
			/>
			<PointActions {...props} submit />
		</form>
	);
}
