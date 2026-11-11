import { useState } from "react";
import { Button } from "#/components/Button";

/** Common posts on a BRF board, offered as suggestions; any title is allowed. */
const TITLE_SUGGESTIONS = [
	"Ordförande",
	"Vice ordförande",
	"Sekreterare",
	"Kassör",
	"Ledamot",
	"Suppleant",
];

export const TITLE_LIST_ID = "title-suggestions";

/** Render once per page; title inputs refer to it with list={TITLE_LIST_ID}. */
export function TitleSuggestions() {
	return (
		<datalist id={TITLE_LIST_ID}>
			{TITLE_SUGGESTIONS.map((t) => (
				<option key={t} value={t} />
			))}
		</datalist>
	);
}

/** A title input with Spara/Avbryt, for editing a title in place. */
export function TitleForm({
	id,
	label,
	title,
	onSave,
	onCancel,
}: {
	id: string;
	label: string;
	title: string;
	onSave: (title: string) => Promise<void>;
	onCancel: () => void;
}) {
	const [error, setError] = useState<string | null>(null);
	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				setError(null);
				try {
					await onSave(String(new FormData(e.currentTarget).get("title")));
				} catch (err) {
					setError(err instanceof Error ? err.message : "Något gick fel.");
				}
			}}
		>
			<p>
				<label htmlFor={id}>{label}</label>
				<input
					id={id}
					name="title"
					list={TITLE_LIST_ID}
					maxLength={60}
					defaultValue={title}
				/>
			</p>
			{error && <p role="alert">{error}</p>}
			<p>
				<Button type="submit">Spara</Button>{" "}
				<Button type="button" onClick={onCancel}>
					Avbryt
				</Button>
			</p>
		</form>
	);
}
