import type {
	ProtocolItem,
	Review,
	ReviewerCandidate,
	ReviewRound,
} from "#/server/items";
import { MultilineText } from "./AgendaView";
import { Button } from "./Button";
import { Instant } from "./DateTime";
import { Section } from "./Section";

/**
 * Justering of a closed protocol: who the justerare are, sending the
 * protocol to them, and how each has answered.
 */
export function ReviewSection({
	items,
	reviewerCandidates,
	review,
	onSend,
}: {
	items: ProtocolItem[];
	reviewerCandidates: ReviewerCandidate[];
	/** The latest sending, or null if never sent. */
	review: ReviewRound | null;
	onSend: () => void;
}) {
	const chosen = items
		.filter((i) => i.type === "reviewers" && !i.value.tabled)
		.flatMap((i) => i.value.reviewers ?? []);

	if (!review) {
		if (chosen.length === 0)
			return (
				<Section id="review" title="Justering">
					<p>
						Inga justerare är valda. Välj dem under punkten ”Val av justerare”
						för att kunna skicka protokollet för justering.
					</p>
				</Section>
			);
		const noEmail = chosen.filter(
			(r) => !reviewerCandidates.find((c) => c.member === r.member)?.hasEmail,
		);
		return (
			<Section id="review" title="Justering">
				<p>
					Protokollet skickas med e-post till {names(chosen.map((r) => r.name))}
					, som läser det och godkänner eller avvisar det.
				</p>
				{noEmail.length > 0 && (
					<p>
						<strong>
							{names(noEmail.map((r) => r.name))} saknar e-postadress.
						</strong>{" "}
						Lägg till den under Inställningar, eller välj en annan justerare.
					</p>
				)}
				<p>
					<Button onClick={onSend} disabled={noEmail.length > 0}>
						Skicka för justering
					</Button>
				</p>
			</Section>
		);
	}

	const canSend = review.changed || review.state === "pending";
	return (
		<Section id="review" title="Justering">
			<p>
				<strong>{STATE_TEXT[review.state]}</strong> Skickades{" "}
				<Instant at={review.sentAt} /> av {review.sentByName}.
			</p>
			{review.changed && (
				<p>
					<strong>Protokollet har ändrats sedan det skickades,</strong>{" "}
					{review.state === "approved"
						? "så justeringen gäller inte längre."
						: "så det behöver skickas igen."}
				</p>
			)}
			{review.state === "declined" && !review.changed && (
				<p>
					Redigera protokollet och rätta det. Sedan kan det skickas för
					justering igen.
				</p>
			)}
			<ul>
				{review.reviews.map((r) => (
					<li key={r.id}>
						<ReviewAnswer review={r} />
					</li>
				))}
			</ul>
			{canSend && (
				<p>
					<Button
						onClick={() => {
							if (
								review.changed ||
								confirm(
									"Skicka igen? Länkarna i det förra mejlet slutar fungera, och de som redan har svarat behöver svara igen.",
								)
							)
								onSend();
						}}
					>
						Skicka för justering igen
					</Button>
				</p>
			)}
		</Section>
	);
}

const STATE_TEXT = {
	pending: "Väntar på justering.",
	approved: "Protokollet är justerat.",
	declined: "Protokollet har avvisats.",
};

function ReviewAnswer({ review }: { review: Review }) {
	if (review.status === "pending")
		return (
			<>
				{review.name}: väntar på svar ({review.email})
			</>
		);
	const at = review.decidedAt && <Instant at={review.decidedAt} />;
	if (review.status === "approved")
		return (
			<>
				{review.name}: godkände {at}
			</>
		);
	return (
		<>
			{review.name}: avvisade {at}
			<blockquote>
				<MultilineText text={review.comment} />
			</blockquote>
		</>
	);
}

/** "Anna", "Anna och Bo". */
const names = (list: string[]) => list.join(" och ");
