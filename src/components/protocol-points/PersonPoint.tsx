import { useState } from "react";
import { Field, Input, Select } from "#/components/Field";
import { DoneView } from "./DoneView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { fieldId, type PointProps, readNotes } from "./point";

const OTHER_PERSON = "__other";

/**
 * Val av person ("person"), e.g. the chair. Choosing a name from the list
 * saves it and makes the point done; "Annan person…" lets you type a name.
 */
export function PersonPoint(props: PointProps & { choosable: string[] }) {
	const { item, done, save, choosable } = props;
	const v = item.value;
	const savedIsOther = !!v.person && !choosable.includes(v.person);
	const [otherPerson, setOtherPerson] = useState(savedIsOther);
	const [notesOpen, setNotesOpen] = useState(!!v.notes);
	if (done) return <DoneView {...props} />;

	const id = (name: string) => fieldId(item, name);
	const read = (form: HTMLFormElement) => {
		const f = new FormData(form);
		const picked = String(f.get("person") ?? "");
		return {
			person:
				picked === OTHER_PERSON ? String(f.get("personOther") ?? "") : picked,
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
			<Field id={id("person")} label="Vald">
				<Select
					name="person"
					defaultValue={savedIsOther ? OTHER_PERSON : (v.person ?? "")}
					required
					onChange={(e) => {
						const picked = e.currentTarget.value;
						setOtherPerson(picked === OTHER_PERSON);
						// Choosing a name from the list saves right away.
						if (picked && picked !== OTHER_PERSON)
							e.currentTarget.form?.requestSubmit();
					}}
				>
					<option value="" disabled>
						Välj person
					</option>
					{choosable.map((name) => (
						<option key={name} value={name}>
							{name}
						</option>
					))}
					<option value={OTHER_PERSON}>Annan person…</option>
				</Select>
			</Field>
			{otherPerson && (
				<Field id={id("personOther")} label="Namn">
					<Input
						name="personOther"
						defaultValue={savedIsOther ? v.person : ""}
						required
					/>
				</Field>
			)}
			<NotesField
				item={item}
				open={notesOpen}
				onOpen={() => setNotesOpen(true)}
			/>
			<PointActions {...props} submit={notesOpen || otherPerson} />
		</form>
	);
}
