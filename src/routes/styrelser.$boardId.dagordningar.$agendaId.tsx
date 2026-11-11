import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { ItemEditor } from "#/components/ItemEditor";
import {
	deleteAgenda,
	getAgenda,
	updateAgenda,
} from "#/server/agendas.functions";

export const Route = createFileRoute(
	"/styrelser/$boardId/dagordningar/$agendaId",
)({
	loader: async ({ params }) => {
		const data = await getAgenda({ data: { agendaId: params.agendaId } });
		if (!data || data.board.id !== params.boardId) throw notFound();
		return data;
	},
	notFoundComponent: () => (
		<main>
			<h1>Dagordningen hittades inte</h1>
			<p>
				<Link to="/styrelser">Tillbaka till styrelser</Link>
			</p>
		</main>
	),
	component: AgendaPage,
});

function AgendaPage() {
	const { board, agenda, items } = Route.useLoaderData();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	async function onSave(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = new FormData(e.currentTarget);
		setError(null);
		setSaved(false);
		try {
			await updateAgenda({
				data: {
					agendaId: agenda.id,
					title: String(f.get("title")),
					meetingAt: String(f.get("meetingAt")),
					location: String(f.get("location")),
				},
			});
			await router.invalidate();
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	async function onDelete() {
		if (!confirm(`Ta bort dagordningen ”${agenda.title}”?`)) return;
		await deleteAgenda({ data: { agendaId: agenda.id } });
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
			</nav>
			<h1>Dagordning: {agenda.title}</h1>

			<section aria-labelledby="meeting">
				<h2 id="meeting">Mötet</h2>
				<form onSubmit={onSave}>
					<p>
						<label htmlFor="title">Rubrik</label>
						<input
							id="title"
							name="title"
							defaultValue={agenda.title}
							required
						/>
					</p>
					<p>
						<label htmlFor="meetingAt">Datum och tid</label>
						<input
							id="meetingAt"
							name="meetingAt"
							type="datetime-local"
							defaultValue={agenda.meetingAt}
						/>
					</p>
					<p>
						<label htmlFor="location">Plats</label>
						<input
							id="location"
							name="location"
							defaultValue={agenda.location}
						/>
					</p>
					{error && <p role="alert">{error}</p>}
					{saved && <output>Sparat.</output>}
					<button type="submit">Spara</button>
				</form>
			</section>

			<ItemEditor kind="agenda" parentId={agenda.id} items={items} />

			<section aria-labelledby="danger">
				<h2 id="danger">Ta bort</h2>
				<button type="button" onClick={onDelete}>
					Ta bort dagordningen
				</button>
			</section>
		</main>
	);
}
