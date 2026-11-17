import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { PointFields } from "#/components/points/PointFields";
import { Section } from "#/components/Section";
import {
	addItem,
	deleteItem,
	moveItem,
	updateItem,
} from "#/server/agendas.functions";
import type { Item } from "#/server/items";

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

/**
 * The points of a template or an agenda, while editing it: each point's
 * fields, moving and removing points, and adding new ones.
 */
export function EditPointList({
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
				<ol className="p-5">
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
				<PointFields idPrefix="new-item" />
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
				<PointFields idPrefix={item.id} item={item} />
				<Button type="submit">Spara</Button>
			</fieldset>
		</form>
	);
}
