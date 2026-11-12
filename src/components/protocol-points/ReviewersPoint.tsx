import { useState } from "react";
import { Field, Select } from "#/components/Field";
import type { MemberRef, ReviewerCandidate } from "#/server/items";
import { DoneView } from "./DoneView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { fieldId, type PointProps, readNotes } from "./point";

/**
 * Val av justerare ("reviewers"): one, or if the point allows it two (the
 * second is optional), chosen among the board members marked present.
 * Guests can't be chosen, since the protocol is sent to the justerare by
 * email, and neither can the meeting's secretary.
 */
export function ReviewersPoint(
	props: PointProps & {
		present: string[];
		reviewerCandidates: ReviewerCandidate[];
		/** Chosen as secretary at this meeting, so not justerare. */
		secretaries: string[];
	},
) {
	const { item, done, save, present, reviewerCandidates, secretaries } = props;
	const count = item.reviewerCount;
	const [chosen, setChosen] = useState<string[]>(() =>
		Array.from(
			{ length: count },
			(_, i) => item.value.reviewers?.[i]?.member ?? "",
		),
	);
	const [notesOpen, setNotesOpen] = useState(!!item.value.notes);
	if (done) return <DoneView {...props} />;

	const choosable = reviewerCandidates.filter((c) => present.includes(c.label));
	const id = (name: string) => fieldId(item, name);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				const f = new FormData(e.currentTarget);
				save({
					reviewers: chosen
						.filter(Boolean)
						.map((member) => ({ name: "", member: member as MemberRef })),
					notes: readNotes(f),
				});
			}}
		>
			{choosable.length === 0 ? (
				<p>
					Justerare väljs bland de närvarande ledamöterna. Markera först vilka
					som är närvarande.
				</p>
			) : (
				chosen.map((member, i) => (
					<Field
						// biome-ignore lint/suspicious/noArrayIndexKey: one field per justerare, fixed in number
						key={i}
						id={id(`reviewer-${i}`)}
						label={
							count === 1
								? "Justerare"
								: i === 0
									? "Justerare 1"
									: "Justerare 2 (om ni har två)"
						}
					>
						<Select
							value={member}
							// Only the first is required; the second may be left out.
							required={i === 0}
							onChange={(e) => {
								const value = e.currentTarget.value;
								setChosen((c) => c.map((m, j) => (j === i ? value : m)));
							}}
						>
							<option value="" disabled={i === 0}>
								{i === 0 ? "Välj justerare" : "Ingen andra justerare"}
							</option>
							{choosable.map((c) => (
								<option
									key={c.member}
									value={c.member}
									// Each person once, and not the secretary.
									disabled={
										secretaries.includes(c.label) ||
										chosen.some((m, j) => j !== i && m === c.member)
									}
								>
									{c.label}
									{secretaries.includes(c.label)
										? " – sekreterare"
										: !c.hasEmail && " – saknar e-postadress"}
								</option>
							))}
						</Select>
					</Field>
				))
			)}
			<NotesField
				item={item}
				open={notesOpen}
				onOpen={() => setNotesOpen(true)}
			/>
			<PointActions {...props} submit={choosable.length > 0} />
		</form>
	);
}
