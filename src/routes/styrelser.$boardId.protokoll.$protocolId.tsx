import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Breadcrumbs } from "#/components/Breadcrumbs";
import { Button } from "#/components/Button";
import { DownloadSection } from "#/components/DownloadSection";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Form } from "#/components/Form";
import { InfoBox } from "#/components/InfoBox";
import { Main } from "#/components/Main";
import { MeetingDetails } from "#/components/MeetingDetails";
import { MeetingForm } from "#/components/MeetingForm";
import { MentionNames } from "#/components/MentionTextarea";
import { PageHeader } from "#/components/PageHeader";
import { ProtocolDisplay, ProtocolHistory } from "#/components/ProtocolDisplay";
import { MeetingPointList } from "#/components/points/lists/MeetingPointList";
import { unfinishedHint } from "#/components/points/moment/MomentForm";
import { PointFields } from "#/components/points/PointFields";
import { ReviewSection } from "#/components/ReviewSection";
import { Section } from "#/components/Section";
import { ShareSection } from "#/components/ShareSection";
import { useFocusMessage } from "#/components/useFocusMessage";
import { addItem, deleteItem } from "#/server/agendas.functions";
import type {
	CarryOverFlags,
	ProtocolValue,
	ReviewRound,
} from "#/server/items";
import { unfinishedPoints } from "#/server/items";
import {
	closeProtocol,
	deleteProtocol,
	getProtocol,
	regenerateProtocolShareId,
	saveItemValue,
	setCarryOver,
	updateProtocol,
} from "#/server/protocols.functions";
import { sendForReview } from "#/server/reviews.functions";

export const Route = createFileRoute(
	"/styrelser/$boardId/protokoll/$protocolId",
)({
	loader: async ({ params }) => {
		const data = await getProtocol({
			data: { protocolId: params.protocolId },
		});
		if (!data || data.board.id !== params.boardId) throw notFound();
		return data;
	},
	notFoundComponent: () => (
		<Main>
			<PageHeader title="Protokollet hittades inte">
				<p>
					<Link to="/">Tillbaka till Mina föreningar</Link>
				</p>
			</PageHeader>
		</Main>
	),
	component: ProtocolPage,
});

function ProtocolPage() {
	const {
		board,
		protocol,
		items,
		memberNames,
		reviewerCandidates,
		people,
		edits,
		review,
		justering,
	} = Route.useLoaderData();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [addFormKey, setAddFormKey] = useState(0);
	const [editingDetails, setEditingDetails] = useState(false);

	// A closed protocol is shown read-only. "Redigera protokollet" starts an
	// editing session; the server records it at the end of the protocol.
	const closed = protocol.closedAt !== null;
	const [editSession, setEditSession] = useState<string | null>(null);
	const editable = !closed || editSession !== null;
	const session = editSession ?? undefined;
	const hasClosePoint = items.some((i) => i.type === "close");
	const unfinished = unfinishedPoints(items);
	const closeBlocked = useFocusMessage();

	// Who can be picked in person choices: those marked present if attendance
	// has been taken, otherwise every member and invited guest.
	const invited = unique([
		...memberNames,
		...items.flatMap((i) => (i.type === "attendance" ? i.extraNames : [])),
	]);
	const present = unique(
		items.flatMap((i) =>
			i.type === "attendance" ? (i.value.present ?? []) : [],
		),
	);
	const choosable = present.length > 0 ? present : invited;

	// Who can be @-mentioned in notes: the board, plus invited guests.
	const mentionable = [
		...people,
		...unique(
			items.flatMap((i) => (i.type === "attendance" ? i.extraNames : [])),
		)
			.filter((name) => !people.some((p) => p.name === name))
			.map((name) => ({ name, label: name })),
	];

	async function run(action: () => Promise<unknown>) {
		setError(null);
		try {
			await action();
			await router.invalidate();
			return true;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
			return false;
		}
	}

	const saveValue = (itemId: string) => (value: ProtocolValue) =>
		run(() => saveItemValue({ data: { itemId, value, editSession: session } }));

	const saveCarryOver = (itemId: string) => (flags: CarryOverFlags) =>
		run(() =>
			setCarryOver({ data: { itemId, ...flags, editSession: session } }),
		);

	async function onAdd(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = new FormData(e.currentTarget);
		const ok = await run(() =>
			addItem({
				data: {
					kind: "protocol",
					parentId: protocol.id,
					editSession: session,
					title: String(f.get("title") ?? ""),
					type: String(f.get("type") ?? ""),
					description: String(f.get("description") ?? ""),
					extraNames: String(f.get("extraNames") ?? "").split("\n"),
					reviewerCount: String(f.get("reviewerCount") ?? ""),
					yesText: String(f.get("yesText") ?? ""),
					noText: String(f.get("noText") ?? ""),
				},
			}),
		);
		if (ok) setAddFormKey((k) => k + 1);
	}

	async function onDelete() {
		if (!confirm(`Ta bort protokollet ”${protocol.title}”?`)) return;
		await deleteProtocol({ data: { protocolId: protocol.id } });
		await router.navigate({
			to: "/styrelser/$boardId",
			params: { boardId: board.id },
		});
	}

	function onCloseProtocol() {
		if (
			!confirm("Stäng protokollet? Ändringar efter det noteras i protokollet.")
		)
			return;
		run(() => closeProtocol({ data: { protocolId: protocol.id } }));
	}

	const share = (
		<ShareSection
			path={`/protokoll/${protocol.shareId}`}
			intro={
				<p>
					Alla som har länken kan läsa protokollet, utan att logga in
					{closed
						? "."
						: ", men först när protokollet är stängt. Innan dess visar länken bara att det inte är klart."}
				</p>
			}
			linkText="Visa det delade protokollet"
			onRegenerate={() =>
				regenerateProtocolShareId({ data: { protocolId: protocol.id } })
			}
		/>
	);

	const doneEditing = (
		<p>
			<Button icon="check" type="button" onClick={() => setEditSession(null)}>
				Klar med redigeringen
			</Button>
		</p>
	);

	return (
		<MentionNames.Provider value={mentionable}>
			<Main>
				<Breadcrumbs>
					<Link to="/">Mina föreningar</Link>
					<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
						{board.name}
					</Link>
				</Breadcrumbs>
				<PageHeader title={`Protokoll: ${protocol.title}`}>
					{/* The protocol sits next to its agenda, not under it. */}
					{protocol.agendaId && (
						<p>
							<Link
								to="/styrelser/$boardId/dagordningar/$agendaId"
								params={{ boardId: board.id, agendaId: protocol.agendaId }}
							>
								Se dagordningen
							</Link>
						</p>
					)}
				</PageHeader>

				{!editable ? (
					<>
						<p>
							<Button
								icon="edit"
								type="button"
								onClick={() => {
									const warning = review && editWarning(review);
									if (!warning || confirm(warning))
										setEditSession(crypto.randomUUID());
								}}
							>
								Redigera protokollet
							</Button>
						</p>
						<ProtocolDisplay
							protocol={protocol}
							items={items}
							edits={edits}
							justering={justering}
						/>
						<ErrorMessage error={error} />
						<ReviewSection
							items={items}
							reviewerCandidates={reviewerCandidates}
							review={review}
							onSend={() =>
								run(() => sendForReview({ data: { protocolId: protocol.id } }))
							}
						/>
						<DownloadSection base={`/api/protokoll/${protocol.id}`} />
						{share}
					</>
				) : (
					<>
						{closed && (
							<InfoBox aria-label="Stängt protokoll">
								<p>
									<strong>Du redigerar ett stängt protokoll.</strong> Att det
									har redigerats, av vem och när, noteras i slutet av
									protokollet.
								</p>
								{doneEditing}
							</InfoBox>
						)}

						{editingDetails ? (
							<>
								<MeetingForm
									initial={protocol}
									onSave={async (details) => {
										await updateProtocol({
											data: {
												protocolId: protocol.id,
												editSession: session,
												...details,
											},
										});
										await router.invalidate();
										setEditingDetails(false);
									}}
								/>
								<p>
									<Button
										icon="x"
										type="button"
										onClick={() => setEditingDetails(false)}
									>
										Avbryt
									</Button>
								</p>
							</>
						) : (
							<Section id="meeting" title="Mötet">
								<MeetingDetails
									meetingAt={protocol.meetingAt}
									location={protocol.location}
								/>
								<p>
									<Button
										icon="edit-2"
										type="button"
										onClick={() => setEditingDetails(true)}
									>
										Ändra mötesuppgifter
									</Button>
								</p>
							</Section>
						)}

						<Section id="points" title="Dagordning">
							<ErrorMessage error={error} />
							<MeetingPointList
								items={items}
								invited={invited}
								choosable={choosable}
								present={present}
								reviewerCandidates={reviewerCandidates}
								onSave={saveValue}
								onCarryOver={saveCarryOver}
								onDelete={(item) => {
									if (confirm(`Ta bort punkten ”${item.title}”?`))
										run(() =>
											deleteItem({
												data: {
													kind: "protocol",
													itemId: item.id,
													editSession: session,
												},
											}),
										);
								}}
							/>

							<h3 className="text-2xl">Lägg till mötespunkt</h3>
							<Form key={addFormKey} onSubmit={onAdd}>
								<PointFields idPrefix="new-item" />
								<Button icon="plus" type="submit">
									Lägg till
								</Button>
							</Form>
						</Section>

						{!closed && !hasClosePoint && (
							<>
								<p>
									<Button
										icon="lock"
										type="button"
										onClick={() =>
											unfinished.length > 0
												? closeBlocked.show()
												: onCloseProtocol()
										}
									>
										Stäng protokollet
									</Button>
								</p>
								{closeBlocked.shown && unfinished.length > 0 && (
									<p
										ref={closeBlocked.ref}
										tabIndex={-1}
										className="font-medium outline-none"
									>
										{unfinishedHint(unfinished)}
									</p>
								)}
							</>
						)}

						{closed && (
							<>
								<ProtocolHistory closedAt={protocol.closedAt} edits={edits} />
								{doneEditing}
							</>
						)}

						{share}

						<Section id="danger" title="Ta bort">
							<p>Dagordningen påverkas inte.</p>
							<Button icon="trash-2" type="button" onClick={onDelete}>
								Ta bort protokollet
							</Button>
						</Section>
					</>
				)}
			</Main>
		</MentionNames.Provider>
	);
}

function unique(names: string[]) {
	return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

/**
 * What to ask before editing a protocol that has been sent for justering:
 * a change means sending it again. Nothing to ask if it was declined (it
 * is meant to be edited) or has already changed.
 */
function editWarning(review: ReviewRound): string | null {
	if (review.changed || review.state === "declined") return null;
	return review.state === "approved"
		? "Protokollet är justerat. Ändrar du något gäller inte justeringen längre, och protokollet måste justeras igen. Redigera ändå?"
		: "Protokollet väntar på justering. Ändrar du något måste det skickas för justering igen. Redigera ändå?";
}
