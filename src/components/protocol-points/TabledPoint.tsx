import { Button } from "../Button";
import { NotesEditor } from "./NotesEditor";
import type { PointProps } from "./point";

/** A tabled point ("bordlagd"), of any kind: comes back at the next meeting. */
export function TabledPoint({ item, save, carryOver }: PointProps) {
	const v = item.value;
	return (
		<>
			<p>
				<strong>Bordlagd</strong> – kommer med på dagordningen till nästa möte.
			</p>
			<NotesEditor
				idPrefix={item.id}
				notes={v.notes}
				onSave={(notes) => save({ ...v, notes })}
			/>
			<p>
				<Button onClick={() => carryOver({ tabled: false })}>
					Ångra bordläggning
				</Button>
			</p>
		</>
	);
}
