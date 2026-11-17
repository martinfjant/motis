import { useState } from "react";
import { Radio } from "#/components/Choice";
import { Form } from "#/components/Form";
import { DoneView } from "../shared/DoneView";
import { NotesField } from "../shared/NotesField";
import { PointActions } from "../shared/PointActions";
import { fieldId, type PointProps, readNotes } from "../shared/point";
import { answerText } from "./toggleText";

/** Ja/nej ("toggle"). Choosing an answer saves it and makes the point done. */
export function ToggleForm(props: PointProps) {
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
		<Form
			onSubmit={(e) => {
				e.preventDefault();
				save(read(e.currentTarget));
			}}
		>
			<div className="grid grid-cols-3 gap-2 w-full max-w-screen-sm">
				<Radio
					id={id("answer-yes")}
					label={answerText(true)}
					name="answer"
					value="yes"
					defaultChecked={v.answer === true}
					required
					onChange={(e) => e.currentTarget.form?.requestSubmit()}
				/>{" "}
				<Radio
					id={id("answer-no")}
					label={answerText(false)}
					name="answer"
					value="no"
					defaultChecked={v.answer === false}
					required
					onChange={(e) => e.currentTarget.form?.requestSubmit()}
				/>
			</div>
			<NotesField
				item={item}
				open={notesOpen}
				onOpen={() => setNotesOpen(true)}
			/>
			<PointActions {...props} submit={notesOpen} />
		</Form>
	);
}
