import { useState } from "react";
import { KlarView } from "./KlarView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { fieldId, type PointProps, readNotes } from "./point";

const OTHER_PERSON = "__other";

/**
 * Val av person ("person"), e.g. the chair. Choosing a name from the list
 * saves it and makes the point klar; "Annan person…" lets you type a name.
 */
export function PersonPoint(props: PointProps & { choosable: string[] }) {
	const { item, klar, save, choosable } = props;
	const v = item.value;
	const savedIsOther = !!v.person && !choosable.includes(v.person);
	const [otherPerson, setOtherPerson] = useState(savedIsOther);
	const [notesOpen, setNotesOpen] = useState(!!v.notes);
	if (klar) return <KlarView {...props} />;

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
			<p>
				<label htmlFor={id("person")}>Vald</label>
				<select
					id={id("person")}
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
				</select>
			</p>
			{otherPerson && (
				<p>
					<label htmlFor={id("personOther")}>Namn</label>
					<input
						id={id("personOther")}
						name="personOther"
						defaultValue={savedIsOther ? v.person : ""}
						required
					/>
				</p>
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
