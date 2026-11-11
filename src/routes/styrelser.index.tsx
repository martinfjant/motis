import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { createBoard, getMyBoards } from "#/server/boards.functions";

export const Route = createFileRoute("/styrelser/")({
	loader: () => getMyBoards(),
	component: Boards,
});

function Boards() {
	const boards = Route.useLoaderData();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const name = String(new FormData(form).get("name"));
		setPending(true);
		setError(null);
		try {
			const board = await createBoard({ data: { name } });
			await router.navigate({
				to: "/styrelser/$boardId",
				params: { boardId: board.id },
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
			setPending(false);
		}
	}

	return (
		<main>
			<h1>Styrelser</h1>
			<section aria-labelledby="my-boards">
				<h2 id="my-boards">Dina styrelser</h2>
				{boards.length === 0 ? (
					<p>Du är inte med i någon styrelse ännu.</p>
				) : (
					<ul>
						{boards.map((b) => (
							<li key={b.id}>
								<Link to="/styrelser/$boardId" params={{ boardId: b.id }}>
									{b.name}
								</Link>{" "}
								({b.role === "admin" ? "administratör" : "ledamot"})
							</li>
						))}
					</ul>
				)}
			</section>
			<section aria-labelledby="new-board">
				<h2 id="new-board">Skapa ny styrelse</h2>
				<form onSubmit={onSubmit}>
					<p>
						<label htmlFor="name">Föreningens namn</label>
						<input id="name" name="name" required />
					</p>
					{error && <p role="alert">{error}</p>}
					<button type="submit" disabled={pending}>
						Skapa styrelse
					</button>
				</form>
			</section>
		</main>
	);
}
