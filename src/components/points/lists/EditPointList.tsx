import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Form } from "#/components/Form";
import { PointFields } from "#/components/points/PointFields";
import { Section } from "#/components/Section";
import {
	addItem,
	deleteItem,
	moveItem,
	updateItem,
} from "#/server/agendas.functions";
import { canMove, type Item } from "#/server/items";

type Kind = "template" | "agenda";

function readItem(form: HTMLFormElement) {
	const f = new FormData(form);
	return {
		title: String(f.get("title") ?? ""),
		type: String(f.get("type") ?? ""),
		description: String(f.get("description") ?? ""),
		extraNames: String(f.get("extraNames") ?? "").split("\n"),
		reviewerCount: String(f.get("reviewerCount") ?? ""),
		yesText: String(f.get("yesText") ?? ""),
		noText: String(f.get("noText") ?? ""),
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
				<ol className="list-decimal p-5 space-y-10">
					{items.map((item, i) => (
						<li key={item.id} className="pl-2 space-y-2.5">
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
							{/* Only the moves that can happen: the opening stays first and the closing last. */}
							<p>
								{canMove(items, i, -1) && (
									<Button
										icon="arrow-up"
										type="button"
										onClick={() =>
											run(() =>
												moveItem({
													data: { kind, itemId: item.id, direction: -1 },
												}),
											)
										}
									>
										Flytta upp
									</Button>
								)}{" "}
								{canMove(items, i, 1) && (
									<Button
										icon="arrow-down"
										type="button"
										onClick={() =>
											run(() =>
												moveItem({
													data: { kind, itemId: item.id, direction: 1 },
												}),
											)
										}
									>
										Flytta ner
									</Button>
								)}{" "}
								<Button
									icon="trash-2"
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
			<Form key={addFormKey} onSubmit={onAdd}>
				<PointFields idPrefix="new-item" />
				<Button icon="plus" type="submit">
					Lägg till
				</Button>
			</Form>
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
		<Form
			onSubmit={(e) => {
				e.preventDefault();
				onSave(e.currentTarget);
			}}
		>
			<fieldset className="block space-y-5">
				<legend className="text-xl font-bold">{item.title}</legend>
				<PointFields idPrefix={item.id} item={item} />
				<Button icon="save" type="submit">
					Spara
				</Button>
			</fieldset>
		</Form>
	);
}
