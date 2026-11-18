import { createFileRoute, notFound } from "@tanstack/react-router";
import { AttachmentsProvider } from "#/components/Attachments";
import { DownloadSection } from "#/components/DownloadSection";
import { Main } from "#/components/Main";
import { PageHeader } from "#/components/PageHeader";
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
			<PageHeader title="Protokollet hittades inte">
				<p>
					Länken kan vara felskriven, eller så har styrelsen bytt ut eller tagit
					bort den.
				</p>
			</PageHeader>
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
				<PageHeader
					title="Protokollet är inte klart ännu"
					context={data.board.name}
				>
					<p>
						Mötet pågår eller protokollet håller på att skrivas. Det går att
						läsa här när det är stängt.
					</p>
				</PageHeader>
			</Main>
		);

	return (
		<AttachmentsProvider
			attachments={data.attachments}
			base={`/api/delat-protokoll/${shareId}/bilagor`}
		>
			<Main>
				{/* Same spacing as Main, which this article sits in. */}
				<article className="space-y-2.5">
					<PageHeader
						title={`Protokoll: ${data.protocol.title}`}
						context={data.board.name}
					/>
					<ProtocolDisplay
						protocol={data.protocol}
						items={data.items}
						edits={data.edits}
						justering={data.justering}
					/>
				</article>
				<DownloadSection
					base={`/api/delat-protokoll/${shareId}`}
					attachments={data.attachments.length}
				/>
			</Main>
		</AttachmentsProvider>
	);
}
