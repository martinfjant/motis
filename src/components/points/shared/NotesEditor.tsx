import { useState } from "react";
import { Button } from "#/components/Button";
import { Field } from "#/components/Field";
import { MentionTextarea } from "#/components/MentionTextarea";
import { MultilineText } from "#/components/MultilineText";

/**
 * Notes on their own, for points whose main content is not a form (opening
 * and closing, tabled points): shown as text, edited behind "Lägg till
 * anteckning" / "Ändra anteckning".
 */
export function NotesEditor({
	idPrefix,
	notes,
	onSave,
}: {
	idPrefix: string;
	notes?: string;
	onSave: (notes: string) => Promise<boolean>;
}) {
	const [open, setOpen] = useState(false);
	const id = `${idPrefix}-notes`;

	if (!open)
		return (
			<>
				{notes && <MultilineText text={notes} />}
				<p>
					<Button onClick={() => setOpen(true)}>
						{notes ? "Ändra anteckning" : "Lägg till anteckning"}
					</Button>
				</p>
			</>
		);

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				const value = String(new FormData(e.currentTarget).get("notes") ?? "");
				if (await onSave(value)) setOpen(false);
			}}
		>
			<Field id={id} label="Anteckningar">
				{/* Opened by an explicit click, so focus goes straight to it. */}
				<MentionTextarea name="notes" defaultValue={notes} autoFocus />
			</Field>
			<Button type="submit">Klar</Button>{" "}
			<Button onClick={() => setOpen(false)}>Avbryt</Button>
		</form>
	);
}
