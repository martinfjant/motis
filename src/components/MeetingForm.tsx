import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { Notice } from "#/components/Notice";
import { Section } from "#/components/Section";

export type MeetingDetails = {
	title: string;
	meetingAt: string;
	location: string;
};

/** Title, time and place of a meeting, shared by agendas and protocols. */
export function MeetingForm({
	initial,
	onSave,
}: {
	initial: MeetingDetails;
	onSave: (details: MeetingDetails) => Promise<unknown>;
}) {
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = new FormData(e.currentTarget);
		setError(null);
		setSaved(false);
		try {
			await onSave({
				title: String(f.get("title")),
				meetingAt: String(f.get("meetingAt")),
				location: String(f.get("location")),
			});
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	return (
		<Section id="meeting" title="Mötet">
			<form onSubmit={onSubmit}>
				<Field id="title" label="Rubrik">
					<Input name="title" defaultValue={initial.title} required />
				</Field>
				<Field id="meetingAt" label="Datum och tid">
					<Input
						name="meetingAt"
						type="datetime-local"
						defaultValue={initial.meetingAt}
					/>
				</Field>
				<Field id="location" label="Plats">
					<Input name="location" defaultValue={initial.location} />
				</Field>
				<ErrorMessage error={error} />
				{saved && <Notice>Sparat.</Notice>}
				<Button type="submit">Spara</Button>
			</form>
		</Section>
	);
}
