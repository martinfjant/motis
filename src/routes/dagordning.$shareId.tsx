import { createFileRoute, notFound } from "@tanstack/react-router";
import { Main } from "#/components/Main";
import { MeetingDetails } from "#/components/MeetingDetails";
import { PageHeader } from "#/components/PageHeader";
import { AgendaPointList } from "#/components/points/lists/AgendaPointList";
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
		<Main>
			<PageHeader title="Dagordningen hittades inte">
				<p>
					Länken kan vara felskriven, eller så har styrelsen bytt ut eller tagit
					bort den.
				</p>
			</PageHeader>
		</Main>
	),
	component: PublicAgenda,
});

function PublicAgenda() {
	const { boardName, agenda, items } = Route.useLoaderData();
	return (
		<Main>
			<article>
				<PageHeader title={`Dagordning: ${agenda.title}`} context={boardName}>
					<MeetingDetails
						meetingAt={agenda.meetingAt}
						location={agenda.location}
					/>
				</PageHeader>
				<AgendaPointList items={items} headingLevel={2} />
			</article>
		</Main>
	);
}
