import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Breadcrumbs } from "#/components/Breadcrumbs";
import { Button } from "#/components/Button";
import { useConfirm } from "#/components/ConfirmDialog";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { Form } from "#/components/Form";
import { Main } from "#/components/Main";
import { PageHeader } from "#/components/PageHeader";
import { EditPointList } from "#/components/points/lists/EditPointList";
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
		<Main>
			<PageHeader title="Mallen hittades inte">
				<p>
					<Link to="/">Tillbaka till Mina föreningar</Link>
				</p>
			</PageHeader>
		</Main>
	),
	component: TemplatePage,
});

function TemplatePage() {
	const confirm = useConfirm();
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
		const ok = await confirm({
			title: `Ta bort mallen ”${template.name}”?`,
			confirmLabel: "Ta bort mallen",
			confirmIcon: "trash-2",
		});
		if (!ok) return;
		await deleteTemplate({ data: { templateId: template.id } });
		await router.navigate({
			to: "/styrelser/$boardId/installningar",
			params: { boardId: board.id },
		});
	}

	return (
		<Main>
			<Breadcrumbs>
				<Link to="/">Mina föreningar</Link>
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
			<PageHeader title={`Mall: ${template.name}`}>
				<p>Ändringar i mallen påverkar bara dagordningar som skapas efteråt.</p>
			</PageHeader>

			<Section id="template-settings" title="Namn">
				<Form onSubmit={onRename}>
					<Field id="name" label="Mallens namn">
						<Input name="name" defaultValue={template.name} required />
					</Field>
					<ErrorMessage error={error} />
					<Button icon="save" type="submit">
						Spara namn
					</Button>
				</Form>
			</Section>

			<EditPointList kind="template" parentId={template.id} items={items} />

			<Section id="danger" title="Ta bort">
				<Button icon="trash-2" type="button" onClick={onDelete}>
					Ta bort mallen
				</Button>
			</Section>
		</Main>
	);
}
