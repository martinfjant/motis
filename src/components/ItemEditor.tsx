import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input, Select, Textarea } from "#/components/Field";
import { Section } from "#/components/Section";
import {
	addItem,
	deleteItem,
	moveItem,
	updateItem,
} from "#/server/agendas.functions";
import {
	DEFAULT_REVIEWER_COUNT,
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
		reviewerCount: String(f.get("reviewerCount") ?? ""),
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
		<Section id="items-heading" title="Punkter">
			<ErrorMessage error={error} />
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
								<Button
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
								</Button>{" "}
								<Button
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
								</Button>{" "}
								<Button
									type="button"
									onClick={() => {
										if (confirm(`Ta bort punkten ”${item.title}”?`))
											run(() =>
												deleteItem({ data: { kind, itemId: item.id } }),
											);
									}}
								>
									Ta bort
								</Button>
							</p>
						</li>
					))}
				</ol>
			)}

			<h3>Lägg till punkt</h3>
			<form key={addFormKey} onSubmit={onAdd}>
				<ItemFields idPrefix="new-item" />
				<Button type="submit">Lägg till</Button>
			</form>
		</Section>
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
				<Button type="submit">Spara</Button>
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
			<Field id={id("title")} label="Rubrik">
				<Input name="title" defaultValue={item?.title} required />
			</Field>
			<Field id={id("type")} label="Typ">
				<Select
					name="type"
					value={type}
					onChange={(e) => setType(e.target.value as ItemType)}
				>
					{ITEM_TYPES.map((t) => (
						<option key={t} value={t}>
							{ITEM_TYPE_LABELS[t]}
						</option>
					))}
				</Select>
			</Field>
			<Field id={id("description")} label="Beskrivning">
				<Textarea name="description" defaultValue={item?.description} />
			</Field>
			{type === "attendance" && (
				<Field
					id={id("extraNames")}
					label="Övriga deltagare som inte är ledamöter (ett namn per rad)"
				>
					<Textarea
						name="extraNames"
						defaultValue={item?.extraNames.join("\n")}
					/>
				</Field>
			)}
			{type === "reviewers" && (
				<Field id={id("reviewerCount")} label="Antal justerare">
					<Select
						name="reviewerCount"
						defaultValue={String(item?.reviewerCount ?? DEFAULT_REVIEWER_COUNT)}
					>
						<option value="1">En</option>
						<option value="2">Två</option>
					</Select>
				</Field>
			)}
		</>
	);
}
