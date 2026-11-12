import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { MultilineText } from "#/components/AgendaView";
import { Button } from "#/components/Button";
import { Instant } from "#/components/DateTime";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Textarea } from "#/components/Field";
import { ProtocolDisplay } from "#/components/ProtocolView";
import { Section } from "#/components/Section";
import type { ReviewStatus } from "#/server/items";
import { decideReview, getReviewPage } from "#/server/reviews.functions";

// A justerare's personal page, reached from the email: the protocol
// read-only, and approving or declining it. No account needed; the link is
// the key, so it is kept out of search engines and referrers.
export const Route = createFileRoute("/justera/$token")({
	loader: async ({ params }) => {
		const data = await getReviewPage({ data: { token: params.token } });
		if (!data) throw notFound();
		return data;
	},
	head: ({ loaderData }) => ({
		meta: [
			{ name: "robots", content: "noindex, nofollow" },
			{ name: "referrer", content: "no-referrer" },
			...(loaderData
				? [
						{
							title: `Justera: ${loaderData.protocol.title} – ${loaderData.board.name}`,
						},
					]
				: []),
		],
	}),
	notFoundComponent: () => (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>Länken fungerar inte</h1>
			<p>
				Länken kan ha gått ut eller vara felskriven. Be den som skickade
				protokollet att skicka det igen.
			</p>
		</main>
	),
	component: ReviewPage,
});

function ReviewPage() {
	const data = Route.useLoaderData();
	const { review } = data;

	if (data.replaced)
		return (
			<main className="mx-auto w-4/5 space-y-2.5 p-4">
				<p>{data.board.name}</p>
				<h1>Protokollet har skickats på nytt</h1>
				<p>
					Det här mejlet har ersatts av ett nyare. Använd länken i det senaste
					mejlet om justering av ”{data.protocol.title}”.
				</p>
			</main>
		);

	return (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<article>
				<header>
					<p>{data.board.name}</p>
					<h1>Justera protokollet: {data.protocol.title}</h1>
					<p>
						{data.sentByName} har skickat protokollet till dig, {review.name},
						för justering.
					</p>
				</header>
				<ProtocolDisplay
					protocol={data.protocol}
					items={data.items}
					edits={data.edits}
				/>
			</article>
			<Section id="answer" title="Ditt svar">
				{data.changed && review.status === "pending" ? (
					<p>
						Protokollet har ändrats efter att det skickades till dig. Du får ett
						nytt mejl när det är klart att justera.
					</p>
				) : review.status === "pending" ? (
					<AnswerForm />
				) : (
					<YourAnswer review={review} />
				)}
				{data.others.length > 0 && (
					<>
						<h3>
							{data.others.length === 1
								? "Den andra justeraren"
								: "De andra justerarna"}
						</h3>
						<ul>
							{data.others.map((o) => (
								<li key={o.name}>
									{o.name}: {OTHER_STATUS[o.status]}
								</li>
							))}
						</ul>
					</>
				)}
			</Section>
		</main>
	);
}

const OTHER_STATUS: Record<ReviewStatus, string> = {
	pending: "har inte svarat ännu",
	approved: "har godkänt",
	declined: "har avvisat",
};

function YourAnswer({
	review,
}: {
	review: { status: ReviewStatus; comment: string; decidedAt: string | null };
}) {
	const at = review.decidedAt && <Instant at={review.decidedAt} />;
	if (review.status === "approved")
		return <p>Du godkände protokollet {at}. Tack!</p>;
	return (
		<>
			<p>Du avvisade protokollet {at}, med kommentaren:</p>
			<blockquote>
				<MultilineText text={review.comment} />
			</blockquote>
			<p>När protokollet är rättat får du ett nytt mejl.</p>
		</>
	);
}

function AnswerForm() {
	const { token } = Route.useParams();
	const router = useRouter();
	const [declining, setDeclining] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function answer(approve: boolean, comment = "") {
		setError(null);
		try {
			await decideReview({ data: { token, approve, comment } });
			await router.invalidate();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	return (
		<>
			<ErrorMessage error={error} />
			{!declining ? (
				<>
					<p>
						Stämmer protokollet med det som hände på mötet? Godkänn det, eller
						avvisa det och skriv vad som behöver ändras.
					</p>
					<p>
						<Button
							onClick={() => {
								if (confirm("Godkänna protokollet?")) answer(true);
							}}
						>
							Godkänn protokollet
						</Button>
						<Button onClick={() => setDeclining(true)}>Avvisa…</Button>
					</p>
				</>
			) : (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						const f = new FormData(e.currentTarget);
						answer(false, String(f.get("comment") ?? ""));
					}}
				>
					<Field
						label="Vad behöver ändras?"
						hint="Skickas till den som skickade protokollet."
					>
						<Textarea name="comment" required autoFocus />
					</Field>
					<p>
						<Button type="submit">Avvisa protokollet</Button>
						<Button onClick={() => setDeclining(false)}>Avbryt</Button>
					</p>
				</form>
			)}
		</>
	);
}
