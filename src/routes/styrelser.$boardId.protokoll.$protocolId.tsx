import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { MeetingDetails, MultilineText } from "#/components/AgendaView";
import { ItemFields } from "#/components/ItemEditor";
import { MeetingForm } from "#/components/MeetingForm";
import { MentionNames, MentionTextarea } from "#/components/MentionTextarea";
import {
	MOMENT_TEXT,
	ProtocolDisplay,
	ProtocolHistory,
	RecordedValue,
} from "#/components/ProtocolView";
import { ShareSection } from "#/components/ShareSection";
import { formatMeetingAt, toLocalStamp } from "#/meeting-time";
import { addItem, deleteItem } from "#/server/agendas.functions";
import {
	type CarryOverFlags,
	canCarryOver,
	type ProtocolItem,
	type ProtocolValue,
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
		<main>
			<h1>Protokollet hittades inte</h1>
			<p>
				<Link to="/styrelser">Tillbaka till styrelser</Link>
			</p>
		</main>
	),
	component: ProtocolPage,
});

function ProtocolPage() {
	const { board, protocol, items, memberNames, people, edits } =
		Route.useLoaderData();
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
			<button type="button" onClick={() => setEditSession(null)}>
				Klar med redigeringen
			</button>
		</p>
	);

	return (
		<MentionNames.Provider value={mentionable}>
			<main>
				<nav aria-label="Brödsmula">
					<Link to="/styrelser">Styrelser</Link> ›{" "}
					<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
						{board.name}
					</Link>
				</nav>
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
							<button
								type="button"
								onClick={() => setEditSession(crypto.randomUUID())}
							>
								Redigera protokollet
							</button>
						</p>
						<ProtocolDisplay protocol={protocol} items={items} edits={edits} />
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
									<button
										type="button"
										onClick={() => setEditingDetails(false)}
									>
										Avbryt
									</button>
								</p>
							</>
						) : (
							<section aria-labelledby="meeting">
								<h2 id="meeting">Mötet</h2>
								<MeetingDetails
									meetingAt={protocol.meetingAt}
									location={protocol.location}
								/>
								<p>
									<button type="button" onClick={() => setEditingDetails(true)}>
										Ändra mötesuppgifter
									</button>
								</p>
							</section>
						)}

						<section aria-labelledby="points">
							<h2 id="points">Punkter</h2>
							{error && <p role="alert">{error}</p>}
							{items.length === 0 ? (
								<p>Inga punkter ännu.</p>
							) : (
								<ol>
									{items.map((item) => (
										<li key={item.id}>
											{item.type === "open" || item.type === "close" ? (
												<MeetingMoment
													item={item}
													onSave={saveValue(item.id)}
												/>
											) : (
												<ProtocolItemForm
													item={item}
													invited={invited}
													choosable={choosable}
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
											)}
										</li>
									))}
								</ol>
							)}

							<h3>Lägg till punkt</h3>
							<form key={addFormKey} onSubmit={onAdd}>
								<ItemFields idPrefix="new-item" />
								<button type="submit">Lägg till</button>
							</form>
						</section>

						{!closed && !hasClosePoint && (
							<p>
								<button type="button" onClick={onCloseProtocol}>
									Stäng protokollet
								</button>
							</p>
						)}

						{closed && (
							<>
								<ProtocolHistory closedAt={protocol.closedAt} edits={edits} />
								{doneEditing}
							</>
						)}

						{share}

						<section aria-labelledby="danger">
							<h2 id="danger">Ta bort</h2>
							<p>Dagordningen påverkas inte.</p>
							<button type="button" onClick={onDelete}>
								Ta bort protokollet
							</button>
						</section>
					</>
				)}
			</main>
		</MentionNames.Provider>
	);
}

/** The current time, ticking. Null until mounted so server and client agree. */
function useNow() {
	const [now, setNow] = useState<Date | null>(null);
	useEffect(() => {
		const tick = () => setNow(new Date());
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	}, []);
	return now;
}

/**
 * Opening or closing the meeting: one button that records the current time,
 * then the recorded time with a way to correct it.
 */
function MeetingMoment({
	item,
	onSave,
}: {
	item: ProtocolItem;
	onSave: (value: ProtocolValue) => Promise<boolean>;
}) {
	const text = MOMENT_TEXT[item.type === "close" ? "close" : "open"];
	const v = item.value;
	const at = v.at;
	const now = useNow();
	const [editing, setEditing] = useState(false);
	const inputId = `${item.id}-at`;

	async function onCorrect(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const value = String(new FormData(e.currentTarget).get("at") ?? "");
		if (await onSave({ ...v, at: value })) setEditing(false);
	}

	return (
		<fieldset>
			<legend>{item.title}</legend>
			{item.description && <MultilineText text={item.description} />}
			{editing && at ? (
				<form onSubmit={onCorrect}>
					<p>
						<label htmlFor={inputId}>{text.done}</label>
						<input
							id={inputId}
							name="at"
							type="datetime-local"
							defaultValue={at}
							required
						/>
					</p>
					<button type="submit">Klar</button>{" "}
					<button type="button" onClick={() => setEditing(false)}>
						Avbryt
					</button>
				</form>
			) : at ? (
				<p>
					{text.done} <time dateTime={at}>{formatMeetingAt(at)}</time>{" "}
					<button type="button" onClick={() => setEditing(true)}>
						Ändra
					</button>
				</p>
			) : (
				<p>
					{now && (
						<>
							Klockan är{" "}
							<time dateTime={toLocalStamp(now)}>
								{toLocalStamp(now).slice(11)}
							</time>{" "}
						</>
					)}
					<button
						type="button"
						onClick={() => onSave({ ...v, at: toLocalStamp(new Date()) })}
					>
						{text.button}
					</button>
				</p>
			)}
			{at && (
				<NotesEditor
					idPrefix={item.id}
					notes={v.notes}
					onSave={(notes) => onSave({ ...v, notes })}
				/>
			)}
		</fieldset>
	);
}

/** Notes shown as text, edited behind "Lägg till anteckning" / "Ändra anteckning". */
function NotesEditor({
	idPrefix,
	notes,
	onSave,
}: {
	idPrefix: string;
	notes?: string;
	onSave: (notes: string) => Promise<boolean>;
}) {
	const [open, setOpen] = useState(false);
	const id = `${idPrefix}-notes`;

	if (!open)
		return (
			<>
				{notes && <MultilineText text={notes} />}
				<p>
					<button type="button" onClick={() => setOpen(true)}>
						{notes ? "Ändra anteckning" : "Lägg till anteckning"}
					</button>
				</p>
			</>
		);

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				const value = String(new FormData(e.currentTarget).get("notes") ?? "");
				if (await onSave(value)) setOpen(false);
			}}
		>
			<p>
				<label htmlFor={id}>Anteckningar</label>
				{/* Opened by an explicit click, so focus goes straight to it. */}
				<MentionTextarea id={id} name="notes" defaultValue={notes} autoFocus />
			</p>
			<button type="submit">Klar</button>{" "}
			<button type="button" onClick={() => setOpen(false)}>
				Avbryt
			</button>
		</form>
	);
}

function unique(names: string[]) {
	return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

const OTHER_PERSON = "__other";

/** Whether anything has been recorded for the point yet (flags aside). */
function hasValue(v: ProtocolValue) {
	const { tabled: _t, followUp: _f, ...recorded } = v;
	return Object.keys(recorded).length > 0;
}

/**
 * One protocol point. Shows what was recorded as text with an "Ändra"
 * button; shows the form when nothing is recorded yet or while editing.
 * Matters to discuss can also be tabled or marked for follow-up, which
 * brings them back on the next meeting's agenda.
 */
function ProtocolItemForm({
	item,
	invited,
	choosable,
	onSave,
	onCarryOver,
	onDelete,
}: {
	item: ProtocolItem;
	invited: string[];
	choosable: string[];
	onSave: (value: ProtocolValue) => Promise<boolean>;
	onCarryOver: (flags: CarryOverFlags) => Promise<boolean>;
	onDelete: () => void;
}) {
	const v = item.value;
	const [editing, setEditing] = useState(false);
	// "Klar" closes the form even if nothing was written (a free-text point
	// may have nothing to note); until then an empty point shows its form.
	const [closed, setClosed] = useState(false);
	const showForm = editing || (!hasValue(v) && !closed);
	const carriable = canCarryOver(item.type);

	if (v.tabled)
		return (
			<fieldset>
				<legend>{item.title}</legend>
				{item.description && <MultilineText text={item.description} />}
				<p>
					<strong>Bordlagd</strong> – kommer med på dagordningen till nästa
					möte.
				</p>
				<NotesEditor
					idPrefix={item.id}
					notes={v.notes}
					onSave={(notes) => onSave({ ...v, notes })}
				/>
				<p>
					<button type="button" onClick={() => onCarryOver({ tabled: false })}>
						Ångra bordläggning
					</button>
				</p>
			</fieldset>
		);

	// Follow-up is a checkbox before the buttons while the point is open; once
	// klar it shows as text (see RecordedValue). A point is dealt with in
	// one of two ways: "Klar" or "Bordlägg". Once it is klar it can't be
	// tabled, not even when reopened with "Ändra".
	const followUp = carriable && (
		<p>
			{/* Keyed on the saved state so it shows what the server has. */}
			<input
				key={String(!!v.followUp)}
				id={`${item.id}-followup`}
				type="checkbox"
				defaultChecked={!!v.followUp}
				onChange={(e) => onCarryOver({ followUp: e.currentTarget.checked })}
			/>{" "}
			<label htmlFor={`${item.id}-followup`}>Följ upp på nästa möte</label>
		</p>
	);
	const table = carriable && (
		<>
			<button type="button" onClick={() => onCarryOver({ tabled: true })}>
				Bordlägg
			</button>{" "}
		</>
	);

	return (
		<fieldset>
			<legend>{item.title}</legend>
			{item.description && <MultilineText text={item.description} />}
			{showForm ? (
				<ItemValueForm
					item={item}
					invited={invited}
					choosable={choosable}
					onSave={async (value, stayOpen) => {
						const ok = await onSave(value);
						// Attendance saves on every tick, so it stays open until "Klar".
						if (ok) setEditing(stayOpen);
						if (ok && !stayOpen) setClosed(true);
						return ok;
					}}
					closeLabel={
						editing ? (item.type === "attendance" ? "Klar" : "Avbryt") : null
					}
					onClose={() => setEditing(false)}
					onDelete={onDelete}
					beforeActions={followUp}
					extraAction={editing ? null : table}
				/>
			) : (
				<>
					{/* Klar closes the follow-up choice too; it shows as text. */}
					<RecordedValue item={item} />
					<p>
						<button type="button" onClick={() => setEditing(true)}>
							{hasValue(v) ? "Ändra" : "Lägg till anteckning"}
						</button>
					</p>
				</>
			)}
		</fieldset>
	);
}

function ItemValueForm({
	item,
	invited,
	choosable,
	onSave,
	closeLabel,
	onClose,
	onDelete,
	beforeActions,
	extraAction,
}: {
	item: ProtocolItem;
	invited: string[];
	choosable: string[];
	onSave: (value: ProtocolValue, stayOpen: boolean) => Promise<boolean>;
	closeLabel: string | null;
	onClose: () => void;
	onDelete: () => void;
	/** Shown after the fields, before the buttons (the follow-up checkbox). */
	beforeActions?: ReactNode;
	/** A button between Klar/Avbryt and "Ta bort punkten" (Bordlägg). */
	extraAction?: ReactNode;
}) {
	const id = (name: string) => `${item.id}-${name}`;
	const v = item.value;

	// Attendance: everyone invited gets a checkbox; anyone recorded as present
	// who is not on that list (added by hand) goes in the free-text field.
	const others = (v.present ?? []).filter((n) => !invited.includes(n));

	// Person: pick from the list, or "Annan person" to type a name.
	const savedIsOther = !!v.person && !choosable.includes(v.person);
	const [otherPerson, setOtherPerson] = useState(savedIsOther);

	// Notes are hidden behind a button, except on free-text points where the
	// notes are the whole point.
	const [notesOpen, setNotesOpen] = useState(item.type === "text" || !!v.notes);

	// Only typed content needs an explicit save; choices save themselves.
	const showSave =
		notesOpen ||
		item.type === "decision" ||
		item.type === "next_meeting" ||
		(item.type === "person" && otherPerson);

	function read(form: HTMLFormElement): ProtocolValue {
		const f = new FormData(form);
		const picked = String(f.get("person") ?? "");
		return {
			// Neither radio chosen means no answer yet, not "Nej".
			done:
				f.get("done") === "yes"
					? true
					: f.get("done") === "no"
						? false
						: undefined,
			present: [
				...f.getAll("present").map(String),
				...String(f.get("others") ?? "").split("\n"),
			],
			person:
				picked === OTHER_PERSON ? String(f.get("personOther") ?? "") : picked,
			decision: String(f.get("decision") ?? ""),
			at: String(f.get("at") ?? ""),
			notes: String(f.get("notes") ?? ""),
		};
	}

	const noOnePresent = (value: ProtocolValue) =>
		!value.present?.some((n) => n.trim());

	/** Saves straight from a choice; attendance stays open for more ticks. */
	function autosave(form: HTMLFormElement | null) {
		if (!form) return;
		const value = read(form);
		if (item.type === "attendance") {
			if (!noOnePresent(value)) onSave(value, true);
		} else {
			onSave(value, false);
		}
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				const form = e.currentTarget;
				const value = read(form);
				// A checkbox group cannot be "required" in HTML, so check attendance
				// by hand and report it like the browser reports other fields.
				if (item.type === "attendance" && noOnePresent(value)) {
					const first = form.querySelector<HTMLInputElement>(
						'input[name="present"], textarea[name="others"]',
					);
					first?.setCustomValidity("Markera minst en närvarande.");
					first?.reportValidity();
					return;
				}
				onSave(value, false);
			}}
			onChange={(e) => {
				// Clear the attendance message as soon as something changes.
				e.currentTarget
					.querySelector<HTMLInputElement>(
						'input[name="present"], textarea[name="others"]',
					)
					?.setCustomValidity("");
			}}
		>
			{item.type === "toggle" && (
				<p>
					<input
						id={id("done-yes")}
						name="done"
						type="radio"
						value="yes"
						defaultChecked={v.done === true}
						required
						onChange={(e) => autosave(e.currentTarget.form)}
					/>{" "}
					<label htmlFor={id("done-yes")}>Ja</label>{" "}
					<input
						id={id("done-no")}
						name="done"
						type="radio"
						value="no"
						defaultChecked={v.done === false}
						required
						onChange={(e) => autosave(e.currentTarget.form)}
					/>{" "}
					<label htmlFor={id("done-no")}>Nej</label>
				</p>
			)}

			{item.type === "attendance" && (
				<>
					<fieldset>
						<legend>Närvarande</legend>
						{invited.map((name) => (
							<p key={name}>
								<input
									id={id(`present-${name}`)}
									name="present"
									type="checkbox"
									value={name}
									defaultChecked={(v.present ?? []).includes(name)}
									onChange={(e) => autosave(e.currentTarget.form)}
								/>{" "}
								<label htmlFor={id(`present-${name}`)}>{name}</label>
							</p>
						))}
					</fieldset>
					<p>
						<label htmlFor={id("others")}>
							Övriga närvarande (ett namn per rad)
						</label>
						<textarea
							id={id("others")}
							name="others"
							defaultValue={others.join("\n")}
							onBlur={(e) => autosave(e.currentTarget.form)}
						/>
					</p>
				</>
			)}

			{item.type === "person" && (
				<>
					<p>
						<label htmlFor={id("person")}>Vald</label>
						<select
							id={id("person")}
							name="person"
							defaultValue={savedIsOther ? OTHER_PERSON : (v.person ?? "")}
							required
							onChange={(e) => {
								const picked = e.currentTarget.value;
								setOtherPerson(picked === OTHER_PERSON);
								// Choosing a name from the list saves right away.
								if (picked && picked !== OTHER_PERSON)
									autosave(e.currentTarget.form);
							}}
						>
							<option value="" disabled>
								Välj person
							</option>
							{choosable.map((name) => (
								<option key={name} value={name}>
									{name}
								</option>
							))}
							<option value={OTHER_PERSON}>Annan person…</option>
						</select>
					</p>
					{otherPerson && (
						<p>
							<label htmlFor={id("personOther")}>Namn</label>
							<input
								id={id("personOther")}
								name="personOther"
								defaultValue={savedIsOther ? v.person : ""}
								required
							/>
						</p>
					)}
				</>
			)}

			{item.type === "decision" && (
				<p>
					<label htmlFor={id("decision")}>Beslut</label>
					<MentionTextarea
						id={id("decision")}
						name="decision"
						defaultValue={v.decision}
						required
					/>
				</p>
			)}

			{item.type === "next_meeting" && (
				<p>
					<label htmlFor={id("at")}>Datum och tid</label>
					<input
						id={id("at")}
						name="at"
						type="datetime-local"
						defaultValue={v.at}
						required
					/>
				</p>
			)}

			{notesOpen ? (
				<p>
					<label htmlFor={id("notes")}>Anteckningar</label>
					<MentionTextarea
						id={id("notes")}
						name="notes"
						defaultValue={v.notes}
					/>
				</p>
			) : (
				<p>
					<button type="button" onClick={() => setNotesOpen(true)}>
						Lägg till anteckning
					</button>
				</p>
			)}

			{beforeActions}

			<p>
				{showSave && (
					<>
						<button type="submit">Klar</button>{" "}
					</>
				)}
				{/* Attendance's "Klar" closes; when a note is open the submit
				    "Klar" does that (and saves), so don't show it twice. */}
				{closeLabel && !(showSave && closeLabel === "Klar") && (
					<>
						<button type="button" onClick={onClose}>
							{closeLabel}
						</button>{" "}
					</>
				)}
				{extraAction}
				<button type="button" onClick={onDelete}>
					Ta bort punkten
				</button>
			</p>
		</form>
	);
}
