import { createFileRoute, notFound } from "@tanstack/react-router";
import { AgendaItems, MeetingDetails } from "#/components/AgendaView";
import { getPublicAgenda } from "#/server/agendas.functions";

// Public, read-only agenda. Anyone with the link can see it, so it only
// exposes the board name, meeting details and the points.
export const Route = createFileRoute("/dagordning/$shareId")({
	loader: async ({ params }) => {
		const data = await getPublicAgenda({ data: { shareId: params.shareId } });
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
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
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
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<article>
				<header>
					<p>{boardName}</p>
					<h1>Dagordning: {agenda.title}</h1>
					<MeetingDetails
						meetingAt={agenda.meetingAt}
						location={agenda.location}
					/>
				</header>
				<AgendaItems items={items} headingLevel={2} />
			</article>
		</main>
	);
}
