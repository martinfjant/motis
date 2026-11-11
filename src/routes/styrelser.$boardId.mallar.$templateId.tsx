import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Breadcrumbs } from "#/components/Breadcrumbs";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { ItemEditor } from "#/components/ItemEditor";
import { Section } from "#/components/Section";
import {
	deleteTemplate,
	getTemplate,
	renameTemplate,
} from "#/server/agendas.functions";

export const Route = createFileRoute("/styrelser/$boardId/mallar/$templateId")({
	loader: async ({ params }) => {
		const data = await getTemplate({
			data: { templateId: params.templateId },
		});
		if (!data || data.board.id !== params.boardId) throw notFound();
		return data;
	},
	notFoundComponent: () => (
		<main>
			<h1>Mallen hittades inte</h1>
			<p>
				<Link to="/styrelser">Tillbaka till styrelser</Link>
			</p>
		</main>
	),
	component: TemplatePage,
});

function TemplatePage() {
	const { board, template, items } = Route.useLoaderData();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);

	async function onRename(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const name = String(new FormData(e.currentTarget).get("name"));
		setError(null);
		try {
			await renameTemplate({ data: { templateId: template.id, name } });
			await router.invalidate();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	async function onDelete() {
		if (!confirm(`Ta bort mallen ”${template.name}”?`)) return;
		await deleteTemplate({ data: { templateId: template.id } });
		await router.navigate({
			to: "/styrelser/$boardId/installningar",
			params: { boardId: board.id },
		});
	}

	return (
		<main>
			<Breadcrumbs>
				<Link to="/styrelser">Styrelser</Link>
				<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
					{board.name}
				</Link>
				<Link
					to="/styrelser/$boardId/installningar"
					params={{ boardId: board.id }}
				>
					Inställningar
				</Link>
			</Breadcrumbs>
			<h1>Mall: {template.name}</h1>
			<p>Ändringar i mallen påverkar bara dagordningar som skapas efteråt.</p>

			<Section id="template-settings" title="Namn">
				<form onSubmit={onRename}>
					<Field id="name" label="Mallens namn">
						<Input name="name" defaultValue={template.name} required />
					</Field>
					<ErrorMessage error={error} />
					<Button type="submit">Spara namn</Button>
				</form>
			</Section>

			<ItemEditor kind="template" parentId={template.id} items={items} />

			<Section id="danger" title="Ta bort">
				<Button type="button" onClick={onDelete}>
					Ta bort mallen
				</Button>
			</Section>
		</main>
	);
}
