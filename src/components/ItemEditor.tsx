import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	addItem,
	deleteItem,
	moveItem,
	updateItem,
} from "#/server/agendas.functions";
import {
	ITEM_TYPE_LABELS,
	ITEM_TYPES,
	type Item,
	type ItemType,
} from "#/server/items";

type Kind = "template" | "agenda";

function readItem(form: HTMLFormElement) {
	const f = new FormData(form);
	return {
		title: String(f.get("title") ?? ""),
		type: String(f.get("type") ?? ""),
		description: String(f.get("description") ?? ""),
		extraNames: String(f.get("extraNames") ?? "").split("\n"),
	};
}

/** Edits the ordered list of points on a template or an agenda. */
export function ItemEditor({
	kind,
	parentId,
	items,
}: {
	kind: Kind;
	parentId: string;
	items: Item[];
}) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	// Bumped after each add to remount (and so fully reset) the add form.
	const [addFormKey, setAddFormKey] = useState(0);

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
		const form = e.currentTarget;
		const ok = await run(() =>
			addItem({ data: { kind, parentId, ...readItem(form) } }),
		);
		if (ok) setAddFormKey((k) => k + 1);
	}

	return (
		<section aria-labelledby="items-heading">
			<h2 id="items-heading">Punkter</h2>
			{error && <p role="alert">{error}</p>}
			{items.length === 0 ? (
				<p>Inga punkter ännu.</p>
			) : (
				<ol>
					{items.map((item, i) => (
						<li key={item.id}>
							<ItemForm
								item={item}
								onSave={(form) =>
									run(() =>
										updateItem({
											data: { kind, itemId: item.id, ...readItem(form) },
										}),
									)
								}
							/>
							<p>
								<button
									type="button"
									disabled={i === 0}
									onClick={() =>
										run(() =>
											moveItem({
												data: { kind, itemId: item.id, direction: -1 },
											}),
										)
									}
								>
									Flytta upp
								</button>{" "}
								<button
									type="button"
									disabled={i === items.length - 1}
									onClick={() =>
										run(() =>
											moveItem({
												data: { kind, itemId: item.id, direction: 1 },
											}),
										)
									}
								>
									Flytta ner
								</button>{" "}
								<button
									type="button"
									onClick={() => {
										if (confirm(`Ta bort punkten ”${item.title}”?`))
											run(() =>
												deleteItem({ data: { kind, itemId: item.id } }),
											);
									}}
								>
									Ta bort
								</button>
							</p>
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
	);
}

function ItemForm({
	item,
	onSave,
}: {
	item: Item;
	onSave: (form: HTMLFormElement) => Promise<boolean>;
}) {
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				onSave(e.currentTarget);
			}}
		>
			<fieldset>
				<legend>{item.title}</legend>
				<ItemFields idPrefix={item.id} item={item} />
				<button type="submit">Spara</button>
			</fieldset>
		</form>
	);
}

export function ItemFields({
	idPrefix,
	item,
}: {
	idPrefix: string;
	item?: Item;
}) {
	const [type, setType] = useState<ItemType>(item?.type ?? "text");
	const id = (name: string) => `${idPrefix}-${name}`;
	return (
		<>
			<p>
				<label htmlFor={id("title")}>Rubrik</label>
				<input
					id={id("title")}
					name="title"
					defaultValue={item?.title}
					required
				/>
			</p>
			<p>
				<label htmlFor={id("type")}>Typ</label>
				<select
					id={id("type")}
					name="type"
					value={type}
					onChange={(e) => setType(e.target.value as ItemType)}
				>
					{ITEM_TYPES.map((t) => (
						<option key={t} value={t}>
							{ITEM_TYPE_LABELS[t]}
						</option>
					))}
				</select>
			</p>
			<p>
				<label htmlFor={id("description")}>Beskrivning</label>
				<textarea
					id={id("description")}
					name="description"
					defaultValue={item?.description}
				/>
			</p>
			{type === "attendance" && (
				<p>
					<label htmlFor={id("extraNames")}>
						Övriga deltagare som inte är ledamöter (ett namn per rad)
					</label>
					<textarea
						id={id("extraNames")}
						name="extraNames"
						defaultValue={item?.extraNames.join("\n")}
					/>
				</p>
			)}
		</>
	);
}
