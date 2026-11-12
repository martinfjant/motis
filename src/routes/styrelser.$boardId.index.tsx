import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Breadcrumbs } from "#/components/Breadcrumbs";
import { Button } from "#/components/Button";
import { Checkbox } from "#/components/Choice";
import { Dialog } from "#/components/Dialog";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input, Select } from "#/components/Field";
import { MeetingItem, MeetingList } from "#/components/MeetingList";
import { Section } from "#/components/Section";
import { cannotStart, daysBetween, START_ANY_DAY } from "#/meeting-time";
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
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>Styrelsen hittades inte</h1>
			<p>
				<Link to="/">Tillbaka till Mina föreningar</Link>
			</p>
		</main>
	),
	component: Board,
});

function Board() {
	const { board, agendas, protocols, templates, plan, today } =
		Route.useLoaderData();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const days = (at: string) => (at ? daysBetween(today, at) : undefined);

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
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<Breadcrumbs>
				<Link to="/">Mina föreningar</Link>
			</Breadcrumbs>
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
				<Section id="ongoing" title="Pågående möten">
					<MeetingList>
						{ongoing.map((p) => (
							<MeetingItem
								key={p.id}
								title={
									<Link
										to="/styrelser/$boardId/protokoll/$protocolId"
										params={{ boardId: board.id, protocolId: p.id }}
									>
										{p.title}
									</Link>
								}
								at={p.meetingAt}
								daysUntil={days(p.meetingAt)}
							>
								– protokollet är inte stängt ännu.
							</MeetingItem>
						))}
					</MeetingList>
				</Section>
			)}

			<Section id="upcoming" title="Kommande möten">
				{called.length === 0 && !plan.nextAt && (
					<p>Inga möten är inplanerade.</p>
				)}
				{(called.length > 0 || plan.nextAt) && (
					<MeetingList>
						{called.map((a) => (
							<MeetingItem
								key={a.id}
								title={
									<Link
										to="/styrelser/$boardId/dagordningar/$agendaId"
										params={{ boardId: board.id, agendaId: a.id }}
									>
										{a.title}
									</Link>
								}
								at={a.meetingAt}
								daysUntil={days(a.meetingAt)}
							>
								{/* Startable only on its day; a future date speaks for itself. */}
								{START_ANY_DAY || !cannotStart(a.meetingAt, today) ? (
									<Button type="button" onClick={() => onStartMeeting(a.id)}>
										Starta möte
									</Button>
								) : !a.meetingAt ? (
									<>– inget datum, ange det för att kunna starta mötet.</>
								) : a.meetingAt.slice(0, 10) < today ? (
									<>– datumet har passerat, ändra det för att starta mötet.</>
								) : null}
							</MeetingItem>
						))}
						{plan.nextAt && (
							<MeetingItem
								title="Nästa möte"
								at={plan.nextAt}
								daysUntil={days(plan.nextAt)}
							>
								– bestämt på förra mötet. Ingen kallelse ännu.
							</MeetingItem>
						)}
					</MeetingList>
				)}
				<ErrorMessage error={error} />
				<CallMeetingDialog
					boardId={board.id}
					templates={templates}
					plan={plan}
				/>
			</Section>

			<Section id="held" title="Tidigare möten">
				{held.length === 0 ? (
					<p>Inga hållna möten ännu.</p>
				) : (
					<MeetingList>
						{held.map((p) => (
							<MeetingItem
								key={p.id}
								title={
									<Link
										to="/styrelser/$boardId/protokoll/$protocolId"
										params={{ boardId: board.id, protocolId: p.id }}
									>
										{p.title}
									</Link>
								}
								at={p.meetingAt}
							/>
						))}
					</MeetingList>
				)}
			</Section>
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
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(
		e: React.FormEvent<HTMLFormElement>,
		close: () => void,
	) {
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
			close();
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
		<Dialog
			title="Kalla till möte"
			openLabel="Kalla till möte"
			onClose={() => setError(null)}
		>
			{(close) => (
				<>
					<p>Du gör dagordningen nu och kan ändra den fram till mötet.</p>
					<form onSubmit={(e) => onSubmit(e, close)}>
						<Field id="templateId" label="Mall">
							<Select name="templateId">
								{templates.map((t) => (
									<option key={t.id} value={t.id}>
										{t.name}
									</option>
								))}
								<option value="">Ingen mall (tom dagordning)</option>
							</Select>
						</Field>
						<Field id="title" label="Rubrik">
							<Input name="title" defaultValue="Styrelsemöte" required />
						</Field>
						<Field
							id="meetingAt"
							label="Datum och tid"
							hint={plan.nextAt && "Enligt protokollet från förra mötet."}
						>
							<Input
								name="meetingAt"
								type="datetime-local"
								defaultValue={plan.nextAt}
							/>
						</Field>
						<Field id="location" label="Plats">
							<Input name="location" defaultValue={plan.location} />
						</Field>
						{plan.carryOver.length > 0 && (
							<fieldset>
								<legend>Från förra mötet</legend>
								<p>
									Punkter som bordlades eller ska följas upp. Stående punkter,
									som Ekonomi, får en anteckning; andra läggs in före Övriga
									frågor.
								</p>
								{plan.carryOver.map((c) => (
									<Checkbox
										key={c.itemId}
										id={`carry-${c.itemId}`}
										name="carryOver"
										value={c.itemId}
										defaultChecked
										label={`${c.title} (${REASON[c.reason]})`}
									/>
								))}
							</fieldset>
						)}
						<ErrorMessage error={error} />
						<p>
							<Button type="submit" disabled={pending}>
								Skapa dagordning
							</Button>{" "}
							<Button type="button" onClick={close}>
								Avbryt
							</Button>
						</p>
					</form>
				</>
			)}
		</Dialog>
	);
}
