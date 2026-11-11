import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MeetingDetails } from "#/components/AgendaView";
import { ItemFields } from "#/components/ItemEditor";
import { MeetingForm } from "#/components/MeetingForm";
import { formatMeetingAt, toLocalStamp } from "#/meeting-time";
import { addItem, deleteItem } from "#/server/agendas.functions";
import type { ProtocolItem, ProtocolValue } from "#/server/items";
import {
	deleteProtocol,
	getProtocol,
	saveItemValue,
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
	const { board, protocol, items, memberNames } = Route.useLoaderData();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [addFormKey, setAddFormKey] = useState(0);
	const [editingDetails, setEditingDetails] = useState(false);

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

	async function onAdd(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = new FormData(e.currentTarget);
		const ok = await run(() =>
			addItem({
				data: {
					kind: "protocol",
					parentId: protocol.id,
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

	return (
		<main>
			<nav aria-label="Brödsmula">
				<Link to="/styrelser">Styrelser</Link> ›{" "}
				<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
					{board.name}
				</Link>
				{protocol.agendaId && (
					<>
						{" "}
						›{" "}
						<Link
							to="/styrelser/$boardId/dagordningar/$agendaId"
							params={{ boardId: board.id, agendaId: protocol.agendaId }}
						>
							Dagordning
						</Link>
					</>
				)}
			</nav>
			<h1>Protokoll: {protocol.title}</h1>

			{editingDetails ? (
				<>
					<MeetingForm
						initial={protocol}
						onSave={async (details) => {
							await updateProtocol({
								data: { protocolId: protocol.id, ...details },
							});
							await router.invalidate();
							setEditingDetails(false);
						}}
					/>
					<p>
						<button type="button" onClick={() => setEditingDetails(false)}>
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
				<p>Spara varje punkt när du har fyllt i den.</p>
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
										onSave={(value) =>
											run(() =>
												saveItemValue({ data: { itemId: item.id, value } }),
											)
										}
									/>
								) : (
									<ProtocolItemForm
										item={item}
										invited={invited}
										choosable={choosable}
										onSave={(value) =>
											run(() =>
												saveItemValue({ data: { itemId: item.id, value } }),
											)
										}
										onDelete={() => {
											if (confirm(`Ta bort punkten ”${item.title}”?`))
												run(() =>
													deleteItem({
														data: { kind: "protocol", itemId: item.id },
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

			<section aria-labelledby="danger">
				<h2 id="danger">Ta bort</h2>
				<p>Dagordningen påverkas inte.</p>
				<button type="button" onClick={onDelete}>
					Ta bort protokollet
				</button>
			</section>
		</main>
	);
}

const MOMENT_TEXT = {
	open: { button: "Öppna mötet", done: "Mötet öppnades" },
	close: { button: "Avsluta mötet", done: "Mötet avslutades" },
};

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
	const at = item.value.at;
	const now = useNow();
	const [editing, setEditing] = useState(false);
	const inputId = `${item.id}-at`;

	async function onCorrect(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const value = String(new FormData(e.currentTarget).get("at") ?? "");
		if (await onSave({ at: value })) setEditing(false);
	}

	return (
		<fieldset>
			<legend>{item.title}</legend>
			{item.description && <p>{item.description}</p>}
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
					<button type="submit">Spara</button>{" "}
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
						onClick={() => onSave({ at: toLocalStamp(new Date()) })}
					>
						{text.button}
					</button>
				</p>
			)}
		</fieldset>
	);
}

function unique(names: string[]) {
	return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

function ProtocolItemForm({
	item,
	invited,
	choosable,
	onSave,
	onDelete,
}: {
	item: ProtocolItem;
	invited: string[];
	choosable: string[];
	onSave: (value: ProtocolValue) => Promise<boolean>;
	onDelete: () => void;
}) {
	const [saved, setSaved] = useState(false);
	const id = (name: string) => `${item.id}-${name}`;
	const v = item.value;

	// Attendance: everyone invited gets a checkbox; anyone recorded as present
	// who is not on that list (added by hand) goes in the free-text field.
	const others = (v.present ?? []).filter((n) => !invited.includes(n));

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = new FormData(e.currentTarget);
		setSaved(false);
		const ok = await onSave({
			done: f.get("done") === "on",
			present: [
				...f.getAll("present").map(String),
				...String(f.get("others") ?? "").split("\n"),
			],
			person: String(f.get("person") ?? ""),
			decision: String(f.get("decision") ?? ""),
			notes: String(f.get("notes") ?? ""),
		});
		setSaved(ok);
	}

	return (
		<form onSubmit={onSubmit} onChange={() => setSaved(false)}>
			<fieldset>
				<legend>{item.title}</legend>
				{item.description && <p>{item.description}</p>}
				{item.type === "toggle" && (
					<p>
						<input
							id={id("done")}
							name="done"
							type="checkbox"
							defaultChecked={v.done === true}
						/>{" "}
						<label htmlFor={id("done")}>Ja</label>
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
							/>
						</p>
					</>
				)}
				{item.type === "person" && (
					<p>
						<label htmlFor={id("person")}>Vald</label>
						<input
							id={id("person")}
							name="person"
							list={id("people")}
							defaultValue={v.person}
						/>
						<datalist id={id("people")}>
							{choosable.map((name) => (
								<option key={name} value={name} />
							))}
						</datalist>
					</p>
				)}
				{item.type === "decision" && (
					<p>
						<label htmlFor={id("decision")}>Beslut</label>
						<textarea
							id={id("decision")}
							name="decision"
							defaultValue={v.decision}
						/>
					</p>
				)}
				<p>
					<label htmlFor={id("notes")}>Anteckningar</label>
					<textarea id={id("notes")} name="notes" defaultValue={v.notes} />
				</p>
				<button type="submit">Spara</button>{" "}
				<button type="button" onClick={onDelete}>
					Ta bort punkten
				</button>{" "}
				{saved && <output>Sparat.</output>}
			</fieldset>
		</form>
	);
}
