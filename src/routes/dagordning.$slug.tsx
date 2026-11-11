import { createFileRoute, notFound } from "@tanstack/react-router";
import { Fragment } from "react";
import { formatMeetingAt } from "#/meeting-time";
import { getPublicAgenda } from "#/server/agendas.functions";

// Public, read-only agenda. Anyone with the link can see it, so it only
// exposes the board name, meeting details and the points.
export const Route = createFileRoute("/dagordning/$slug")({
	loader: async ({ params }) => {
		const data = await getPublicAgenda({ data: { slug: params.slug } });
		if (!data) throw notFound();
		return data;
	},
	head: ({ loaderData }) => ({
		meta: [
			// Share links are private by obscurity; keep them out of search engines.
			{ name: "robots", content: "noindex, nofollow" },
			{ name: "referrer", content: "no-referrer" },
			...(loaderData
				? [
						{
							title: `${loaderData.agenda.title} – ${loaderData.boardName}`,
						},
					]
				: []),
		],
	}),
	notFoundComponent: () => (
		<main>
			<h1>Dagordningen hittades inte</h1>
			<p>
				Länken kan vara felskriven, eller så har styrelsen bytt ut eller tagit
				bort den.
			</p>
		</main>
	),
	component: PublicAgenda,
});

function PublicAgenda() {
	const { boardName, agenda, items } = Route.useLoaderData();
	return (
		<main>
			<article>
				<header>
					<p>{boardName}</p>
					<h1>Dagordning: {agenda.title}</h1>
					{(agenda.meetingAt || agenda.location) && (
						<dl>
							{agenda.meetingAt && (
								<>
									<dt>Tid</dt>
									<dd>
										<time dateTime={agenda.meetingAt}>
											{formatMeetingAt(agenda.meetingAt)}
										</time>
									</dd>
								</>
							)}
							{agenda.location && (
								<>
									<dt>Plats</dt>
									<dd>{agenda.location}</dd>
								</>
							)}
						</dl>
					)}
				</header>
				{items.length === 0 ? (
					<p>Dagordningen har inga punkter ännu.</p>
				) : (
					<ol>
						{items.map((item) => (
							<li key={item.id}>
								<h2>{item.title}</h2>
								{item.description
									.split(/\n{2,}/)
									.filter(Boolean)
									.map((para, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: static text paragraphs
										<p key={i}>
											{para.split("\n").map((line, j) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: static text lines
												<Fragment key={j}>
													{j > 0 && <br />}
													{line}
												</Fragment>
											))}
										</p>
									))}
							</li>
						))}
					</ol>
				)}
			</article>
		</main>
	);
}
