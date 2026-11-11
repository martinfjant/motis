import { useState } from "react";
import { Radio } from "../Choice";
import { DoneView } from "./DoneView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { fieldId, type PointProps, readNotes } from "./point";

/** Ja/nej ("toggle"). Choosing an answer saves it and makes the point done. */
export function TogglePoint(props: PointProps) {
	const { item, done, save } = props;
	const v = item.value;
	const [notesOpen, setNotesOpen] = useState(!!v.notes);
	if (done) return <DoneView {...props} />;

	const id = (name: string) => fieldId(item, name);
	const read = (form: HTMLFormElement) => {
		const f = new FormData(form);
		// Neither radio chosen means no answer yet, not "Nej".
		const answer = f.get("answer");
		return {
			answer: answer === "yes" ? true : answer === "no" ? false : undefined,
			notes: readNotes(f),
		};
	};

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				save(read(e.currentTarget));
			}}
		>
			<p>
				<Radio
					id={id("answer-yes")}
					label="Ja"
					name="answer"
					value="yes"
					defaultChecked={v.answer === true}
					required
					onChange={(e) => e.currentTarget.form?.requestSubmit()}
				/>{" "}
				<Radio
					id={id("answer-no")}
					label="Nej"
					name="answer"
					value="no"
					defaultChecked={v.answer === false}
					required
					onChange={(e) => e.currentTarget.form?.requestSubmit()}
				/>
			</p>
			<NotesField
				item={item}
				open={notesOpen}
				onOpen={() => setNotesOpen(true)}
			/>
			<PointActions {...props} submit={notesOpen} />
		</form>
	);
}
