import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Breadcrumbs } from "#/components/Breadcrumbs";
import { Button } from "#/components/Button";
import { CallSection } from "#/components/CallSection";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Main } from "#/components/Main";
import { MeetingDetails } from "#/components/MeetingDetails";
import { MeetingForm } from "#/components/MeetingForm";
import { PageHeader } from "#/components/PageHeader";
import { AgendaPointList } from "#/components/points/lists/AgendaPointList";
import { EditPointList } from "#/components/points/lists/EditPointList";
import { Section } from "#/components/Section";
import { ShareSection } from "#/components/ShareSection";
import { cannotStart, START_ANY_DAY } from "#/meeting-time";
import {
	deleteAgenda,
	getAgenda,
	regenerateAgendaShareId,
	sendCall,
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
		<Main>
			<PageHeader title="Dagordningen hittades inte">
				<p>
					<Link to="/">Tillbaka till Mina föreningar</Link>
				</p>
			</PageHeader>
		</Main>
	),
	component: AgendaPage,
});

function AgendaPage() {
	const { board, agenda, items, protocolId, today, call } =
		Route.useLoaderData();
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
		<Main>
			<Breadcrumbs>
				<Link to="/">Mina föreningar</Link>
				<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
					{board.name}
				</Link>
			</Breadcrumbs>
			<PageHeader title={`Dagordning: ${agenda.title}`} />

			{editing ? (
				<>
					<p>
						<Button
							icon="check"
							type="button"
							onClick={() => setEditing(false)}
						>
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
					<EditPointList kind="agenda" parentId={agenda.id} items={items} />
					<p>
						<Button
							icon="check"
							type="button"
							onClick={() => setEditing(false)}
						>
							Klar med redigeringen
						</Button>
					</p>
					<Section id="danger" title="Ta bort">
						<Button icon="trash-2" type="button" onClick={onDelete}>
							Ta bort dagordningen
						</Button>
					</Section>
				</>
			) : (
				<>
					<p>
						<Button icon="edit" type="button" onClick={() => setEditing(true)}>
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
						<AgendaPointList items={items} headingLevel={3} />
					</Section>
				</>
			)}

			{!protocolId && (
				<CallSection
					{...call}
					onSend={async () => {
						await sendCall({ data: { agendaId: agenda.id } });
						await router.invalidate();
					}}
				/>
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
							<Button icon="play" type="button" onClick={onStartProtocol}>
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
		</Main>
	);
}
