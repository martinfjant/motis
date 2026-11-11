import { useState } from "react";
import { Field, Textarea } from "#/components/Field";
import type { ProtocolValue } from "#/server/items";
import { DoneView } from "./DoneView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { fieldId, type PointProps, readNotes } from "./point";

const PRESENT = 'input[name="present"], textarea[name="others"]';

/**
 * Närvaro ("attendance"): a checkbox per invited person, plus a free-text
 * field for anyone else. Every tick is saved, but the point stays open
 * until "Klar".
 */
export function AttendancePoint(props: PointProps & { invited: string[] }) {
	const { item, done, save, invited } = props;
	const v = item.value;
	const [notesOpen, setNotesOpen] = useState(!!v.notes);
	if (done) return <DoneView {...props} />;

	const id = (name: string) => fieldId(item, name);
	// Anyone recorded as present who is not invited (added by hand) goes in
	// the free-text field.
	const others = (v.present ?? []).filter((n) => !invited.includes(n));

	const read = (form: HTMLFormElement): ProtocolValue => {
		const f = new FormData(form);
		return {
			present: [
				...f.getAll("present").map(String),
				...String(f.get("others") ?? "").split("\n"),
			],
			notes: readNotes(f),
		};
	};
	const noOnePresent = (value: ProtocolValue) =>
		!value.present?.some((n) => n.trim());

	/** Saves a tick without closing the point. */
	function saveTick(form: HTMLFormElement | null) {
		if (!form) return;
		const value = read(form);
		if (!noOnePresent(value)) save(value, false);
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				const form = e.currentTarget;
				const value = read(form);
				// A checkbox group cannot be "required" in HTML, so check by hand
				// and report it like the browser reports other fields.
				if (noOnePresent(value)) {
					const first = form.querySelector<HTMLInputElement>(PRESENT);
					first?.setCustomValidity("Markera minst en närvarande.");
					first?.reportValidity();
					return;
				}
				save(value);
			}}
			onChange={(e) => {
				// Clear the message as soon as something changes.
				e.currentTarget
					.querySelector<HTMLInputElement>(PRESENT)
					?.setCustomValidity("");
			}}
		>
			<fieldset>
				<legend>Närvarande</legend>
				{invited.map((name) => (
					<p key={name}>
						<input
							id={id(`present-${name}`)}
							name="present"
							type="checkbox"
							value={name}
							defaultChecked={(v.present ?? []).includes(name)}
							onChange={(e) => saveTick(e.currentTarget.form)}
						/>{" "}
						<label htmlFor={id(`present-${name}`)}>{name}</label>
					</p>
				))}
			</fieldset>
			<Field id={id("others")} label="Övriga närvarande (ett namn per rad)">
				<Textarea
					name="others"
					defaultValue={others.join("\n")}
					onBlur={(e) => saveTick(e.currentTarget.form)}
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
