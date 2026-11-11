import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import {
	addMember,
	changeMemberRole,
	getBoardDetails,
	removeBoardMember,
} from "#/server/boards.functions";

export const Route = createFileRoute("/styrelser/$boardId")({
	loader: async ({ params }) => {
		const details = await getBoardDetails({
			data: { boardId: params.boardId },
		});
		if (!details) throw notFound();
		return details;
	},
	notFoundComponent: () => (
		<main>
			<h1>Styrelsen hittades inte</h1>
			<p>
				<Link to="/styrelser">Tillbaka till styrelser</Link>
			</p>
		</main>
	),
	component: Board,
});

function Board() {
	const { board, members, currentUserId } = Route.useLoaderData();
	const router = useRouter();
	const isAdmin = board.role === "admin";
	const [error, setError] = useState<string | null>(null);

	async function run(action: () => Promise<unknown>, after?: () => void) {
		setError(null);
		try {
			await action();
			await router.invalidate();
			after?.();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	function onAdd(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const email = String(new FormData(form).get("email"));
		return run(
			() => addMember({ data: { boardId: board.id, email } }),
			() => form.reset(),
		);
	}

	async function onLeave(userId: string) {
		await run(() => removeBoardMember({ data: { boardId: board.id, userId } }));
		if (userId === currentUserId) await router.navigate({ to: "/styrelser" });
	}

	return (
		<main>
			<nav aria-label="Brödsmula">
				<Link to="/styrelser">Styrelser</Link>
			</nav>
			<h1>{board.name}</h1>

			<section aria-labelledby="members">
				<h2 id="members">Ledamöter</h2>
				<ul>
					{members.map((m) => (
						<li key={m.userId}>
							<span>
								{m.name} <small>{m.email}</small>
							</span>{" "}
							<span>{m.role === "admin" ? "Administratör" : "Ledamot"}</span>
							{isAdmin && (
								<button
									type="button"
									onClick={() =>
										run(() =>
											changeMemberRole({
												data: {
													boardId: board.id,
													userId: m.userId,
													role: m.role === "admin" ? "member" : "admin",
												},
											}),
										)
									}
								>
									{m.role === "admin"
										? "Gör till ledamot"
										: "Gör till administratör"}
								</button>
							)}
							{(isAdmin || m.userId === currentUserId) && (
								<button type="button" onClick={() => onLeave(m.userId)}>
									{m.userId === currentUserId ? "Lämna styrelsen" : "Ta bort"}
								</button>
							)}
						</li>
					))}
				</ul>
				{error && <p role="alert">{error}</p>}
			</section>

			{isAdmin && (
				<section aria-labelledby="add-member">
					<h2 id="add-member">Lägg till ledamot</h2>
					<form onSubmit={onAdd}>
						<p>
							<label htmlFor="email">E-postadress till personens konto</label>
							<input id="email" name="email" type="email" required />
						</p>
						<button type="submit">Lägg till</button>
					</form>
				</section>
			)}
		</main>
	);
}
