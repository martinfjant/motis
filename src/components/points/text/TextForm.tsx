import { DoneView } from "../shared/DoneView";
import { NotesField } from "../shared/NotesField";
import { PointActions } from "../shared/PointActions";
import { type PointProps, readNotes } from "../shared/point";

/**
 * Fritext ("text"): the notes are the whole point, so the field is open
 * from the start. "Klar" is allowed with nothing written.
 */
export function TextForm(props: PointProps) {
	const { item, done, save } = props;
	if (done) return <DoneView {...props} />;
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				save({ notes: readNotes(new FormData(e.currentTarget)) });
			}}
			className="block space-y-5"
		>
			<NotesField item={item} open onOpen={() => {}} />
			<PointActions {...props} submit />
		</form>
	);
}
