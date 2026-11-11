import type { ProtocolItem } from "#/server/items";
import { Button } from "../Button";
import { MentionTextarea } from "../MentionTextarea";
import { fieldId } from "./point";

/**
 * Notes inside a point's form, behind "Lägg till anteckning" until opened.
 * The point keeps `open`, since an open note needs the "Klar" button.
 */
export function NotesField({
	item,
	open,
	onOpen,
}: {
	item: ProtocolItem;
	open: boolean;
	onOpen: () => void;
}) {
	const id = fieldId(item, "notes");
	if (!open)
		return (
			<p>
				<Button onClick={onOpen}>Lägg till anteckning</Button>
			</p>
		);
	return (
		<p>
			<label htmlFor={id}>Anteckningar</label>
			<MentionTextarea id={id} name="notes" defaultValue={item.value.notes} />
		</p>
	);
}
