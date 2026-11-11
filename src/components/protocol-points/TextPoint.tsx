import { KlarView } from "./KlarView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { type PointProps, readNotes } from "./point";

/**
 * Fritext ("text"): the notes are the whole point, so the field is open
 * from the start. "Klar" is allowed with nothing written.
 */
export function TextPoint(props: PointProps) {
	const { item, klar, save } = props;
	if (klar) return <KlarView {...props} />;
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				save({ notes: readNotes(new FormData(e.currentTarget)) });
			}}
		>
			<NotesField item={item} open onOpen={() => {}} />
			<PointActions {...props} submit />
		</form>
	);
}
