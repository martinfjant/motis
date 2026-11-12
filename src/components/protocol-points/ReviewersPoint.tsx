import { useState } from "react";
import { Field, Select } from "#/components/Field";
import type { MemberRef, ReviewerCandidate } from "#/server/items";
import { DoneView } from "./DoneView";
import { NotesField } from "./NotesField";
import { PointActions } from "./PointActions";
import { fieldId, type PointProps, readNotes } from "./point";

/**
 * Val av justerare ("reviewers"): one or two, as the point is set up, chosen
 * among the board members marked present. Guests can't be chosen, since the
 * protocol is sent to the justerare by email.
 */
export function ReviewersPoint(
	props: PointProps & {
		present: string[];
		reviewerCandidates: ReviewerCandidate[];
	},
) {
	const { item, done, save, present, reviewerCandidates } = props;
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
					reviewers: chosen.map((member) => ({
						name: "",
						member: member as MemberRef,
					})),
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
						label={count === 1 ? "Justerare" : `Justerare ${i + 1}`}
					>
						<Select
							value={member}
							required
							onChange={(e) => {
								const value = e.currentTarget.value;
								setChosen((c) => c.map((m, j) => (j === i ? value : m)));
							}}
						>
							<option value="" disabled>
								Välj justerare
							</option>
							{choosable.map((c) => (
								<option
									key={c.member}
									value={c.member}
									// Each person can only be chosen once.
									disabled={chosen.some((m, j) => j !== i && m === c.member)}
								>
									{c.hasEmail ? c.label : `${c.label} – saknar e-postadress`}
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
