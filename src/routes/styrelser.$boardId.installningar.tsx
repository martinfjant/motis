import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { createTemplate, getBoardOverview } from "#/server/agendas.functions";
import {
	addMember,
	changeMemberRole,
	getBoardDetails,
	removeBoardMember,
} from "#/server/boards.functions";

// Board settings: templates and members, kept off the overview so that
// page can focus on agendas and protocols.
export const Route = createFileRoute("/styrelser/$boardId/installningar")({
	loader: async ({ params }) => {
		const data = { boardId: params.boardId };
		const [details, overview] = await Promise.all([
			getBoardDetails({ data }),
			getBoardOverview({ data }),
		]);
		if (!details || !overview) throw notFound();
		return { ...details, templates: overview.templates };
	},
	notFoundComponent: () => (
		<main>
			<h1>Styrelsen hittades inte</h1>
			<p>
				<Link to="/styrelser">Tillbaka till styrelser</Link>
			</p>
		</main>
	),
	component: Settings,
});

function Settings() {
	const { board, members, currentUserId, templates } = Route.useLoaderData();
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

	function onCreateTemplate(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const name = String(new FormData(e.currentTarget).get("templateName"));
		return run(async () => {
			const template = await createTemplate({
				data: { boardId: board.id, name },
			});
			await router.navigate({
				to: "/styrelser/$boardId/mallar/$templateId",
				params: { boardId: board.id, templateId: template.id },
			});
		});
	}

	async function onLeave(userId: string) {
		await run(() => removeBoardMember({ data: { boardId: board.id, userId } }));
		if (userId === currentUserId) await router.navigate({ to: "/styrelser" });
	}

	return (
		<main>
			<nav aria-label="Brödsmula">
				<Link to="/styrelser">Styrelser</Link> ›{" "}
				<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
					{board.name}
				</Link>
			</nav>
			<h1>Inställningar</h1>
			{error && <p role="alert">{error}</p>}

			<section aria-labelledby="templates">
				<h2 id="templates">Mallar</h2>
				{templates.length === 0 ? (
					<p>
						Inga mallar.{" "}
						<button
							type="button"
							onClick={() =>
								run(() =>
									createTemplate({
										data: { boardId: board.id, fromDefault: true },
									}),
								)
							}
						>
							Lägg till standardmallen
						</button>
					</p>
				) : (
					<ul>
						{templates.map((t) => (
							<li key={t.id}>
								<Link
									to="/styrelser/$boardId/mallar/$templateId"
									params={{ boardId: board.id, templateId: t.id }}
								>
									{t.name}
								</Link>
							</li>
						))}
					</ul>
				)}

				<h3>Ny mall</h3>
				<form onSubmit={onCreateTemplate}>
					<p>
						<label htmlFor="templateName">Mallens namn</label>
						<input id="templateName" name="templateName" required />
					</p>
					<button type="submit">Skapa tom mall</button>
				</form>
			</section>

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
