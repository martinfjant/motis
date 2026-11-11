import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { ItemEditor } from "#/components/ItemEditor";
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
			<nav aria-label="Brödsmula">
				<Link to="/styrelser">Styrelser</Link> ›{" "}
				<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
					{board.name}
				</Link>{" "}
				›{" "}
				<Link
					to="/styrelser/$boardId/installningar"
					params={{ boardId: board.id }}
				>
					Inställningar
				</Link>
			</nav>
			<h1>Mall: {template.name}</h1>
			<p>Ändringar i mallen påverkar bara dagordningar som skapas efteråt.</p>

			<section aria-labelledby="template-settings">
				<h2 id="template-settings">Namn</h2>
				<form onSubmit={onRename}>
					<p>
						<label htmlFor="name">Mallens namn</label>
						<input
							id="name"
							name="name"
							defaultValue={template.name}
							required
						/>
					</p>
					{error && <p role="alert">{error}</p>}
					<button type="submit">Spara namn</button>
				</form>
			</section>

			<ItemEditor kind="template" parentId={template.id} items={items} />

			<section aria-labelledby="danger">
				<h2 id="danger">Ta bort</h2>
				<button type="button" onClick={onDelete}>
					Ta bort mallen
				</button>
			</section>
		</main>
	);
}
