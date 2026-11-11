import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { AgendaItems, MeetingDetails } from "#/components/AgendaView";
import { ItemEditor } from "#/components/ItemEditor";
import { MeetingForm } from "#/components/MeetingForm";
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
		<main>
			<h1>Dagordningen hittades inte</h1>
			<p>
				<Link to="/styrelser">Tillbaka till styrelser</Link>
			</p>
		</main>
	),
	component: AgendaPage,
});

function AgendaPage() {
	const { board, agenda, items, protocolId } = Route.useLoaderData();
	const router = useRouter();
	const [editing, setEditing] = useState(false);

	async function onStartProtocol() {
		const protocol = await createProtocol({ data: { agendaId: agenda.id } });
		await router.navigate({
			to: "/styrelser/$boardId/protokoll/$protocolId",
			params: { boardId: board.id, protocolId: protocol.id },
		});
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
		<main>
			<nav aria-label="Brödsmula">
				<Link to="/styrelser">Styrelser</Link> ›{" "}
				<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
					{board.name}
				</Link>
			</nav>
			<h1>Dagordning: {agenda.title}</h1>

			{editing ? (
				<>
					<p>
						<button type="button" onClick={() => setEditing(false)}>
							Klar med redigeringen
						</button>
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
						<button type="button" onClick={() => setEditing(false)}>
							Klar med redigeringen
						</button>
					</p>
					<section aria-labelledby="danger">
						<h2 id="danger">Ta bort</h2>
						<button type="button" onClick={onDelete}>
							Ta bort dagordningen
						</button>
					</section>
				</>
			) : (
				<>
					<p>
						<button type="button" onClick={() => setEditing(true)}>
							Redigera dagordningen
						</button>
					</p>
					<section aria-labelledby="meeting">
						<h2 id="meeting">Mötet</h2>
						<MeetingDetails
							meetingAt={agenda.meetingAt}
							location={agenda.location}
						/>
						{!agenda.meetingAt && !agenda.location && (
							<p>Tid och plats är inte angivna.</p>
						)}
					</section>
					<section aria-labelledby="points">
						<h2 id="points">Punkter</h2>
						<AgendaItems items={items} headingLevel={3} />
					</section>
				</>
			)}

			<section aria-labelledby="protocol">
				<h2 id="protocol">Protokoll</h2>
				{protocolId ? (
					<p>
						<Link
							to="/styrelser/$boardId/protokoll/$protocolId"
							params={{ boardId: board.id, protocolId }}
						>
							Öppna protokollet
						</Link>
					</p>
				) : (
					<>
						<p>
							Protokollet skapas som en kopia av dagordningen. Dagordningen
							finns kvar som den är.
						</p>
						<button type="button" onClick={onStartProtocol}>
							Skapa protokoll
						</button>
					</>
				)}
			</section>

			<ShareSection agendaId={agenda.id} shareId={agenda.shareId} />
		</main>
	);
}

function ShareSection({
	agendaId,
	shareId,
}: {
	agendaId: string;
	shareId: string;
}) {
	const router = useRouter();
	const [status, setStatus] = useState<string | null>(null);

	async function onCopy() {
		const url = `${window.location.origin}/dagordning/${shareId}`;
		try {
			await navigator.clipboard.writeText(url);
			setStatus("Länken är kopierad.");
		} catch {
			setStatus(`Kunde inte kopiera. Länken är: ${url}`);
		}
	}

	async function onRegenerate() {
		if (
			!confirm(
				"Skapa en ny länk? Den gamla länken slutar fungera för alla som har fått den.",
			)
		)
			return;
		await regenerateAgendaShareId({ data: { agendaId } });
		await router.invalidate();
		setStatus("En ny länk har skapats. Den gamla fungerar inte längre.");
	}

	return (
		<section aria-labelledby="share">
			<h2 id="share">Dela</h2>
			<p>Alla som har länken kan läsa dagordningen, utan att logga in.</p>
			<p>
				<Link to="/dagordning/$shareId" params={{ shareId }}>
					Visa den delade dagordningen
				</Link>
			</p>
			<p>
				<button type="button" onClick={onCopy}>
					Kopiera länken
				</button>{" "}
				<button type="button" onClick={onRegenerate}>
					Skapa ny länk
				</button>
			</p>
			{status && <output>{status}</output>}
		</section>
	);
}
