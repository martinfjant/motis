import { useState } from "react";
import { Button } from "#/components/Button";

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
		<section aria-labelledby="meeting">
			<h2 id="meeting">Mötet</h2>
			<form onSubmit={onSubmit}>
				<p>
					<label htmlFor="title">Rubrik</label>
					<input
						id="title"
						name="title"
						defaultValue={initial.title}
						required
					/>
				</p>
				<p>
					<label htmlFor="meetingAt">Datum och tid</label>
					<input
						id="meetingAt"
						name="meetingAt"
						type="datetime-local"
						defaultValue={initial.meetingAt}
					/>
				</p>
				<p>
					<label htmlFor="location">Plats</label>
					<input
						id="location"
						name="location"
						defaultValue={initial.location}
					/>
				</p>
				{error && <p role="alert">{error}</p>}
				{saved && <output>Sparat.</output>}
				<Button type="submit">Spara</Button>
			</form>
		</section>
	);
}
