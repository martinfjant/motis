import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { AgendaItems, MeetingDetails } from "#/components/AgendaView";
import { Breadcrumbs } from "#/components/Breadcrumbs";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { ItemEditor } from "#/components/ItemEditor";
import { MeetingForm } from "#/components/MeetingForm";
import { Section } from "#/components/Section";
import { ShareSection } from "#/components/ShareSection";
import { cannotStart, START_ANY_DAY } from "#/meeting-time";
import {
	deleteAgenda,
	getAgenda,
	regenerateAgendaShareId,
	updateAgenda,
} from "#/server/agendas.functions";
import { createProtocol } from "#/server/protocols.functions";

export const Route = createFileRoute(
	"/styrelser/$boardId/dagordningar/$agendaId",
)({
	loader: async ({ params }) => {
		const data = await getAgenda({ data: { agendaId: params.agendaId } });
		if (!data || data.board.id !== params.boardId) throw notFound();
		return data;
	},
	notFoundComponent: () => (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>Dagordningen hittades inte</h1>
			<p>
				<Link to="/">Tillbaka till Mina föreningar</Link>
			</p>
		</main>
	),
	component: AgendaPage,
});

function AgendaPage() {
	const { board, agenda, items, protocolId, today } = Route.useLoaderData();
	const router = useRouter();
	const [editing, setEditing] = useState(false);
	const [startError, setStartError] = useState<string | null>(null);
	const notToday = START_ANY_DAY ? null : cannotStart(agenda.meetingAt, today);

	async function onStartProtocol() {
		setStartError(null);
		try {
			const protocol = await createProtocol({ data: { agendaId: agenda.id } });
			await router.navigate({
				to: "/styrelser/$boardId/protokoll/$protocolId",
				params: { boardId: board.id, protocolId: protocol.id },
			});
		} catch (err) {
			setStartError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	async function onDelete() {
		if (!confirm(`Ta bort dagordningen ”${agenda.title}”?`)) return;
		await deleteAgenda({ data: { agendaId: agenda.id } });
		await router.navigate({
			to: "/styrelser/$boardId",
			params: { boardId: board.id },
		});
	}

	return (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<Breadcrumbs>
				<Link to="/">Mina föreningar</Link>
				<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
					{board.name}
				</Link>
			</Breadcrumbs>
			<h1>Dagordning: {agenda.title}</h1>

			{editing ? (
				<>
					<p>
						<Button type="button" onClick={() => setEditing(false)}>
							Klar med redigeringen
						</Button>
					</p>
					<MeetingForm
						initial={agenda}
						onSave={async (details) => {
							await updateAgenda({ data: { agendaId: agenda.id, ...details } });
							await router.invalidate();
						}}
					/>
					<ItemEditor kind="agenda" parentId={agenda.id} items={items} />
					<p>
						<Button type="button" onClick={() => setEditing(false)}>
							Klar med redigeringen
						</Button>
					</p>
					<Section id="danger" title="Ta bort">
						<Button type="button" onClick={onDelete}>
							Ta bort dagordningen
						</Button>
					</Section>
				</>
			) : (
				<>
					<p>
						<Button type="button" onClick={() => setEditing(true)}>
							Redigera dagordningen
						</Button>
					</p>
					<Section id="meeting" title="Mötet">
						<MeetingDetails
							meetingAt={agenda.meetingAt}
							location={agenda.location}
						/>
						{!agenda.meetingAt && !agenda.location && (
							<p>Tid och plats är inte angivna.</p>
						)}
					</Section>
					<Section id="points" title="Punkter">
						<AgendaItems items={items} headingLevel={3} />
					</Section>
				</>
			)}

			<Section id="protocol" title="Protokoll">
				{protocolId ? (
					<p>
						<Link
							to="/styrelser/$boardId/protokoll/$protocolId"
							params={{ boardId: board.id, protocolId }}
						>
							Se protokoll
						</Link>
					</p>
				) : (
					<>
						<p>
							Protokollet skapas som en kopia av dagordningen när mötet startar.
							Dagordningen finns kvar som den är.
						</p>
						{notToday ? (
							<p>{notToday}</p>
						) : (
							<Button type="button" onClick={onStartProtocol}>
								Starta möte
							</Button>
						)}
						<ErrorMessage error={startError} />
					</>
				)}
			</Section>

			<ShareSection
				path={`/dagordning/${agenda.shareId}`}
				intro={
					<p>Alla som har länken kan läsa dagordningen, utan att logga in.</p>
				}
				linkText="Visa den delade dagordningen"
				onRegenerate={() =>
					regenerateAgendaShareId({ data: { agendaId: agenda.id } })
				}
			/>
		</main>
	);
}
