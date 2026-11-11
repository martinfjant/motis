import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useRef, useState } from "react";
import { formatMeetingAt } from "#/meeting-time";
import { createAgenda, getBoardOverview } from "#/server/agendas.functions";

export const Route = createFileRoute("/styrelser/$boardId/")({
	loader: async ({ params }) => {
		const overview = await getBoardOverview({
			data: { boardId: params.boardId },
		});
		if (!overview) throw notFound();
		return overview;
	},
	notFoundComponent: () => (
		<main>
			<h1>Styrelsen hittades inte</h1>
			<p>
				<Link to="/styrelser">Tillbaka till styrelser</Link>
			</p>
		</main>
	),
	component: Board,
});

function Board() {
	const { board, agendas, protocols, templates } = Route.useLoaderData();

	return (
		<main>
			<nav aria-label="Brödsmula">
				<Link to="/styrelser">Styrelser</Link>
			</nav>
			<h1>{board.name}</h1>
			<p>
				<Link
					to="/styrelser/$boardId/installningar"
					params={{ boardId: board.id }}
				>
					Inställningar: mallar och ledamöter
				</Link>
			</p>

			<section aria-labelledby="agendas">
				<h2 id="agendas">Dagordningar</h2>
				<NewAgendaDialog boardId={board.id} templates={templates} />
				{agendas.length === 0 ? (
					<p>Inga dagordningar ännu.</p>
				) : (
					<ul>
						{agendas.map((a) => (
							<li key={a.id}>
								<Link
									to="/styrelser/$boardId/dagordningar/$agendaId"
									params={{ boardId: board.id, agendaId: a.id }}
								>
									{a.title}
								</Link>
								{a.meetingAt && (
									<>
										{" "}
										<time dateTime={a.meetingAt}>
											{formatMeetingAt(a.meetingAt)}
										</time>
									</>
								)}
							</li>
						))}
					</ul>
				)}
			</section>

			<section aria-labelledby="protocols">
				<h2 id="protocols">Protokoll</h2>
				{protocols.length === 0 ? (
					<p>Inga protokoll ännu. Skapa ett från en dagordning.</p>
				) : (
					<ul>
						{protocols.map((p) => (
							<li key={p.id}>
								<Link
									to="/styrelser/$boardId/protokoll/$protocolId"
									params={{ boardId: board.id, protocolId: p.id }}
								>
									{p.title}
								</Link>
								{p.meetingAt && (
									<>
										{" "}
										<time dateTime={p.meetingAt}>
											{formatMeetingAt(p.meetingAt)}
										</time>
									</>
								)}
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}

/** "Skapa ny dagordning" button that opens the creation form in a modal dialog. */
function NewAgendaDialog({
	boardId,
	templates,
}: {
	boardId: string;
	templates: { id: string; name: string }[];
}) {
	const router = useRouter();
	const dialog = useRef<HTMLDialogElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = new FormData(e.currentTarget);
		setError(null);
		setPending(true);
		try {
			const agenda = await createAgenda({
				data: {
					boardId,
					templateId: String(f.get("templateId")),
					title: String(f.get("title")),
					meetingAt: String(f.get("meetingAt")),
					location: String(f.get("location")),
				},
			});
			dialog.current?.close();
			await router.navigate({
				to: "/styrelser/$boardId/dagordningar/$agendaId",
				params: { boardId, agendaId: agenda.id },
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<p>
				<button type="button" onClick={() => dialog.current?.showModal()}>
					Skapa ny dagordning
				</button>
			</p>
			<dialog
				ref={dialog}
				aria-labelledby="new-agenda"
				onClose={(e) => {
					e.currentTarget.querySelector("form")?.reset();
					setError(null);
				}}
			>
				<h2 id="new-agenda">Ny dagordning</h2>
				<form onSubmit={onSubmit}>
					<p>
						<label htmlFor="templateId">Mall</label>
						<select id="templateId" name="templateId">
							{templates.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
							<option value="">Ingen mall (tom dagordning)</option>
						</select>
					</p>
					<p>
						<label htmlFor="title">Rubrik</label>
						<input
							id="title"
							name="title"
							defaultValue="Styrelsemöte"
							required
						/>
					</p>
					<p>
						<label htmlFor="meetingAt">Datum och tid</label>
						<input id="meetingAt" name="meetingAt" type="datetime-local" />
					</p>
					<p>
						<label htmlFor="location">Plats</label>
						<input id="location" name="location" />
					</p>
					{error && <p role="alert">{error}</p>}
					<p>
						<button type="submit" disabled={pending}>
							Skapa dagordning
						</button>{" "}
						<button type="button" onClick={() => dialog.current?.close()}>
							Avbryt
						</button>
					</p>
				</form>
			</dialog>
		</>
	);
}
