import { createFileRoute, notFound } from "@tanstack/react-router";
import { DownloadSection } from "#/components/DownloadSection";
import { Main } from "#/components/Main";
import { ProtocolDisplay } from "#/components/ProtocolDisplay";
import { getPublicProtocol } from "#/server/protocols.functions";

// Public, read-only protocol. Anyone with the link can read it once the
// protocol is closed; before that the page only says it is not finished.
export const Route = createFileRoute("/protokoll/$shareId")({
	loader: async ({ params }) => {
		const data = await getPublicProtocol({
			data: { shareId: params.shareId },
		});
		if (!data) throw notFound();
		return data;
	},
	head: ({ loaderData }) => ({
		meta: [
			// Share links are private by obscurity; keep them out of search engines.
			{ name: "robots", content: "noindex, nofollow" },
			{ name: "referrer", content: "no-referrer" },
			...(loaderData?.status === "closed"
				? [
						{
							title: `Protokoll: ${loaderData.protocol.title} – ${loaderData.board.name}`,
						},
					]
				: []),
		],
	}),
	notFoundComponent: () => (
		<Main>
			<h1>Protokollet hittades inte</h1>
			<p>
				Länken kan vara felskriven, eller så har styrelsen bytt ut eller tagit
				bort den.
			</p>
		</Main>
	),
	component: PublicProtocol,
});

function PublicProtocol() {
	const data = Route.useLoaderData();
	const { shareId } = Route.useParams();

	if (data.status === "open")
		return (
			<Main>
				<p>{data.board.name}</p>
				<h1>Protokollet är inte klart ännu</h1>
				<p>
					Mötet pågår eller protokollet håller på att skrivas. Det går att läsa
					här när det är stängt.
				</p>
			</Main>
		);

	return (
		<Main>
			<article>
				<header>
					<p>{data.board.name}</p>
					<h1>Protokoll: {data.protocol.title}</h1>
				</header>
				<ProtocolDisplay
					protocol={data.protocol}
					items={data.items}
					edits={data.edits}
					justering={data.justering}
				/>
			</article>
			<DownloadSection base={`/api/delat-protokoll/${shareId}`} />
		</Main>
	);
}
