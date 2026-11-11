import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
	cannotStart,
	daysBetween,
	daysUntilText,
	formatMeetingAt,
	START_ANY_DAY,
} from "#/meeting-time";
import { callMeeting, getBoardOverview } from "#/server/agendas.functions";
import type { MeetingPlan } from "#/server/meetings.server";
import { createProtocol } from "#/server/protocols.functions";

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

/** A meeting time, with "om 3 dagar" when it is today or later. */
function When({ at, today }: { at: string; today: string }) {
	if (!at) return null;
	const days = daysBetween(today, at);
	return (
		<>
			<time dateTime={at}>{formatMeetingAt(at)}</time>
			{days >= 0 && ` (${daysUntilText(days)})`}
		</>
	);
}

function Board() {
	const { board, agendas, protocols, templates, plan, today } =
		Route.useLoaderData();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);

	// A meeting goes: called (agenda) → started (open protocol) → held
	// (closed protocol). Agendas that have been started show as their protocol.
	const called = agendas
		.filter((a) => !a.protocolId)
		.sort((a, b) => a.meetingAt.localeCompare(b.meetingAt));
	const ongoing = protocols.filter((p) => !p.closedAt);
	const held = protocols.filter((p) => p.closedAt);

	// Starting the meeting creates the protocol from the agenda and opens it.
	async function onStartMeeting(agendaId: string) {
		setError(null);
		try {
			const protocol = await createProtocol({ data: { agendaId } });
			await router.navigate({
				to: "/styrelser/$boardId/protokoll/$protocolId",
				params: { boardId: board.id, protocolId: protocol.id },
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

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

			{ongoing.length > 0 && (
				<section aria-labelledby="ongoing">
					<h2 id="ongoing">Pågående möten</h2>
					<ul>
						{ongoing.map((p) => (
							<li key={p.id}>
								<Link
									to="/styrelser/$boardId/protokoll/$protocolId"
									params={{ boardId: board.id, protocolId: p.id }}
								>
									{p.title}
								</Link>{" "}
								<When at={p.meetingAt} today={today} /> – protokollet är inte
								stängt ännu.
							</li>
						))}
					</ul>
				</section>
			)}

			<section aria-labelledby="upcoming">
				<h2 id="upcoming">Kommande möten</h2>
				{called.length === 0 && !plan.nextAt && (
					<p>Inga möten är inplanerade.</p>
				)}
				{(called.length > 0 || plan.nextAt) && (
					<ul>
						{called.map((a) => (
							<li key={a.id}>
								<Link
									to="/styrelser/$boardId/dagordningar/$agendaId"
									params={{ boardId: board.id, agendaId: a.id }}
								>
									{a.title}
								</Link>{" "}
								<When at={a.meetingAt} today={today} />{" "}
								{/* Startable only on its day; a future date speaks for itself. */}
								{START_ANY_DAY || !cannotStart(a.meetingAt, today) ? (
									<button type="button" onClick={() => onStartMeeting(a.id)}>
										Starta möte
									</button>
								) : !a.meetingAt ? (
									<>– inget datum, ange det för att kunna starta mötet.</>
								) : a.meetingAt.slice(0, 10) < today ? (
									<>– datumet har passerat, ändra det för att starta mötet.</>
								) : null}
							</li>
						))}
						{plan.nextAt && (
							<li>
								<When at={plan.nextAt} today={today} /> – bestämt på förra
								mötet. Ingen kallelse ännu.
							</li>
						)}
					</ul>
				)}
				{error && <p role="alert">{error}</p>}
				<CallMeetingDialog
					boardId={board.id}
					templates={templates}
					plan={plan}
				/>
			</section>

			<section aria-labelledby="held">
				<h2 id="held">Tidigare möten</h2>
				{held.length === 0 ? (
					<p>Inga hållna möten ännu.</p>
				) : (
					<ul>
						{held.map((p) => (
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

const REASON = { tabled: "bordlagd", followUp: "följs upp" };

/**
 * "Kalla till möte": the agenda for the next meeting, in a modal dialog.
 * Starts from what the previous meeting decided: its date for the next
 * meeting, its place, and the points that were tabled or are to be followed
 * up.
 */
function CallMeetingDialog({
	boardId,
	templates,
	plan,
}: {
	boardId: string;
	templates: { id: string; name: string }[];
	plan: MeetingPlan;
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
			const agenda = await callMeeting({
				data: {
					boardId,
					templateId: String(f.get("templateId")),
					title: String(f.get("title")),
					meetingAt: String(f.get("meetingAt")),
					location: String(f.get("location")),
					carryOver: f.getAll("carryOver").map(String),
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
					Kalla till möte
				</button>
			</p>
			<dialog
				ref={dialog}
				aria-labelledby="call-meeting"
				onClose={(e) => {
					e.currentTarget.querySelector("form")?.reset();
					setError(null);
				}}
			>
				<h2 id="call-meeting">Kalla till möte</h2>
				<p>Du gör dagordningen nu och kan ändra den fram till mötet.</p>
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
						<input
							id="meetingAt"
							name="meetingAt"
							type="datetime-local"
							defaultValue={plan.nextAt}
							aria-describedby={plan.nextAt ? "meetingAt-hint" : undefined}
						/>
					</p>
					{plan.nextAt && (
						<p id="meetingAt-hint">Enligt protokollet från förra mötet.</p>
					)}
					<p>
						<label htmlFor="location">Plats</label>
						<input id="location" name="location" defaultValue={plan.location} />
					</p>
					{plan.carryOver.length > 0 && (
						<fieldset>
							<legend>Från förra mötet</legend>
							<p>
								Punkter som bordlades eller ska följas upp. Stående punkter, som
								Ekonomi, får en anteckning; andra läggs in före Övriga frågor.
							</p>
							{plan.carryOver.map((c) => (
								<p key={c.itemId}>
									<input
										id={`carry-${c.itemId}`}
										name="carryOver"
										type="checkbox"
										value={c.itemId}
										defaultChecked
									/>{" "}
									<label htmlFor={`carry-${c.itemId}`}>
										{c.title} ({REASON[c.reason]})
									</label>
								</p>
							))}
						</fieldset>
					)}
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
