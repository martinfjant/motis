import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { ItemFields } from "#/components/ItemEditor";
import { MeetingForm } from "#/components/MeetingForm";
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

			<MeetingForm
				initial={protocol}
				onSave={async (details) => {
					await updateProtocol({
						data: { protocolId: protocol.id, ...details },
					});
					await router.invalidate();
				}}
			/>

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
