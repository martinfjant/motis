import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { MeetingDetails } from "#/components/AgendaView";
import { Breadcrumbs } from "#/components/Breadcrumbs";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { ItemFields } from "#/components/ItemEditor";
import { MeetingForm } from "#/components/MeetingForm";
import { MentionNames } from "#/components/MentionTextarea";
import { ProtocolDisplay, ProtocolHistory } from "#/components/ProtocolView";
import { ProtocolPoint } from "#/components/protocol-points/ProtocolPoint";
import { ReviewSection } from "#/components/ReviewSection";
import { Section } from "#/components/Section";
import { ShareSection } from "#/components/ShareSection";
import { addItem, deleteItem } from "#/server/agendas.functions";
import type {
	CarryOverFlags,
	ProtocolValue,
	ReviewRound,
} from "#/server/items";
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
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>Protokollet hittades inte</h1>
			<p>
				<Link to="/">Tillbaka till Mina föreningar</Link>
			</p>
		</main>
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
			<Button type="button" onClick={() => setEditSession(null)}>
				Klar med redigeringen
			</Button>
		</p>
	);

	return (
		<MentionNames.Provider value={mentionable}>
			<main className="mx-auto w-4/5 space-y-2.5 p-4">
				<Breadcrumbs>
					<Link to="/">Mina föreningar</Link>
					<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
						{board.name}
					</Link>
				</Breadcrumbs>
				<h1>Protokoll: {protocol.title}</h1>
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

				{!editable ? (
					<>
						<p>
							<Button
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
						<ProtocolDisplay protocol={protocol} items={items} edits={edits} />
						<ErrorMessage error={error} />
						<ReviewSection
							items={items}
							reviewerCandidates={reviewerCandidates}
							review={review}
							onSend={() =>
								run(() => sendForReview({ data: { protocolId: protocol.id } }))
							}
						/>
						{share}
					</>
				) : (
					<>
						{closed && (
							<>
								<p>
									<strong>Du redigerar ett stängt protokoll.</strong> Att det
									har redigerats, av vem och när, noteras i slutet av
									protokollet.
								</p>
								{doneEditing}
							</>
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
									<Button type="button" onClick={() => setEditingDetails(true)}>
										Ändra mötesuppgifter
									</Button>
								</p>
							</Section>
						)}

						<Section id="points" title="Dagordning">
							<ErrorMessage error={error} />
							{items.length === 0 ? (
								<p>Inga punkter ännu.</p>
							) : (
								<ol>
									{items.map((item) => {
										return (
											<li key={item.id}>
												<ProtocolPoint
													item={item}
													invited={invited}
													choosable={choosable}
													present={present}
													reviewerCandidates={reviewerCandidates}
													onSave={saveValue(item.id)}
													onCarryOver={saveCarryOver(item.id)}
													onDelete={() => {
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
											</li>
										);
									})}
								</ol>
							)}

							<h3>Lägg till punkt</h3>
							<form key={addFormKey} onSubmit={onAdd}>
								<ItemFields idPrefix="new-item" />
								<Button type="submit">Lägg till</Button>
							</form>
						</Section>

						{!closed && !hasClosePoint && (
							<p>
								<Button type="button" onClick={onCloseProtocol}>
									Stäng protokollet
								</Button>
							</p>
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
							<Button type="button" onClick={onDelete}>
								Ta bort protokollet
							</Button>
						</Section>
					</>
				)}
			</main>
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
