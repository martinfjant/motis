import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { Instant } from "#/components/DateTime";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Textarea } from "#/components/Field";
import { Form } from "#/components/Form";
import { Main } from "#/components/Main";
import { MultilineText } from "#/components/MultilineText";
import { PageHeader } from "#/components/PageHeader";
import { ProtocolDisplay } from "#/components/ProtocolDisplay";
import { Section } from "#/components/Section";
import { SignatureField } from "#/components/SignatureField";
import { useFocusMessage } from "#/components/useFocusMessage";
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
		<Main>
			<PageHeader title="Länken fungerar inte">
				<p>
					Länken kan ha gått ut eller vara felskriven. Be den som skickade
					protokollet att skicka det igen.
				</p>
			</PageHeader>
		</Main>
	),
	component: ReviewPage,
});

function ReviewPage() {
	const data = Route.useLoaderData();
	const { review } = data;

	if (data.replaced)
		return (
			<Main>
				<PageHeader
					title="Protokollet har skickats på nytt"
					context={data.board.name}
				>
					<p>
						Det här mejlet har ersatts av ett nyare. Använd länken i det senaste
						mejlet om justering av ”{data.protocol.title}”.
					</p>
				</PageHeader>
			</Main>
		);

	return (
		<Main>
			{/* Same spacing as Main, which this article sits in. */}
			<article className="space-y-2.5">
				<PageHeader
					title={`Justera protokollet: ${data.protocol.title}`}
					context={data.board.name}
				>
					<p>
						{data.sentByName} har skickat protokollet till dig, {review.name},
						för justering.
					</p>
				</PageHeader>
				<ProtocolDisplay
					protocol={data.protocol}
					items={data.items}
					edits={data.edits}
					justering={data.justering}
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
						<ul className="list-disc pl-6">
							{data.others.map((o) => (
								<li key={o.name}>
									{o.name}: {OTHER_STATUS[o.status]}
								</li>
							))}
						</ul>
					</>
				)}
			</Section>
		</Main>
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
	const [mode, setMode] = useState<"choose" | "approve" | "decline">("choose");
	const [signature, setSignature] = useState<string | null>(null);
	const needSignature = useFocusMessage();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function answer(input: {
		approve: boolean;
		comment?: string;
		signature?: string;
	}) {
		if (pending) return; // already saving: ignore a second press
		setError(null);
		setPending(true);
		try {
			await decideReview({ data: { token, comment: "", ...input } });
			await router.invalidate();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<ErrorMessage error={error} />
			{mode === "choose" && (
				<>
					<p>
						Stämmer protokollet med det som hände på mötet? Godkänn det med din
						signatur, eller avvisa det och skriv vad som behöver ändras.
					</p>
					<p>
						<Button icon="pen-tool" onClick={() => setMode("approve")}>
							Godkänn och signera…
						</Button>
						<Button icon="x-circle" onClick={() => setMode("decline")}>
							Avvisa…
						</Button>
					</p>
				</>
			)}
			{mode === "approve" && (
				<Form
					onSubmit={(e) => {
						e.preventDefault();
						if (!signature) return needSignature.show();
						answer({ approve: true, signature });
					}}
				>
					<SignatureField
						label="Rita din signatur med musen eller fingret. Genom att signera godkänner du protokollet."
						onChange={setSignature}
					/>
					<p>
						<Button icon="pen-tool" type="submit" aria-busy={pending}>
							Godkänn och signera
						</Button>
						<Button
							icon="x"
							onClick={() => {
								setSignature(null);
								setMode("choose");
							}}
						>
							Avbryt
						</Button>
					</p>
					{needSignature.shown && !signature && (
						<p
							ref={needSignature.ref}
							tabIndex={-1}
							className="font-medium outline-none"
						>
							Rita din signatur först.
						</p>
					)}
				</Form>
			)}
			{mode === "decline" && (
				<Form
					onSubmit={(e) => {
						e.preventDefault();
						const f = new FormData(e.currentTarget);
						answer({ approve: false, comment: String(f.get("comment") ?? "") });
					}}
				>
					<Field
						label="Vad behöver ändras?"
						hint="Skickas till den som skickade protokollet."
					>
						<Textarea name="comment" required autoFocus />
					</Field>
					<p>
						<Button icon="x-circle" type="submit" aria-busy={pending}>
							Avvisa protokollet
						</Button>
						<Button icon="x" onClick={() => setMode("choose")}>
							Avbryt
						</Button>
					</p>
				</Form>
			)}
		</>
	);
}
