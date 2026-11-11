import { useState } from "react";
import { KlarView } from "./KlarView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { fieldId, type PointProps, readNotes } from "./point";

/** Ja/nej ("toggle"). Choosing an answer saves it and makes the point klar. */
export function TogglePoint(props: PointProps) {
	const { item, klar, save } = props;
	const v = item.value;
	const [notesOpen, setNotesOpen] = useState(!!v.notes);
	if (klar) return <KlarView {...props} />;

	const id = (name: string) => fieldId(item, name);
	const read = (form: HTMLFormElement) => {
		const f = new FormData(form);
		// Neither radio chosen means no answer yet, not "Nej".
		const done = f.get("done");
		return {
			done: done === "yes" ? true : done === "no" ? false : undefined,
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
				<input
					id={id("done-yes")}
					name="done"
					type="radio"
					value="yes"
					defaultChecked={v.done === true}
					required
					onChange={(e) => e.currentTarget.form?.requestSubmit()}
				/>{" "}
				<label htmlFor={id("done-yes")}>Ja</label>{" "}
				<input
					id={id("done-no")}
					name="done"
					type="radio"
					value="no"
					defaultChecked={v.done === false}
					required
					onChange={(e) => e.currentTarget.form?.requestSubmit()}
				/>{" "}
				<label htmlFor={id("done-no")}>Nej</label>
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
