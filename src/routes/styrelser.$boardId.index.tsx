import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { formatMeetingAt } from "#/meeting-time";
import {
	createAgenda,
	createTemplate,
	getBoardOverview,
} from "#/server/agendas.functions";
import {
	addMember,
	changeMemberRole,
	getBoardDetails,
	removeBoardMember,
} from "#/server/boards.functions";

export const Route = createFileRoute("/styrelser/$boardId/")({
	loader: async ({ params }) => {
		const data = { boardId: params.boardId };
		const [details, overview] = await Promise.all([
			getBoardDetails({ data }),
			getBoardOverview({ data }),
		]);
		if (!details || !overview) throw notFound();
		return { ...details, ...overview };
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
	const { board, members, currentUserId, agendas, protocols, templates } =
		Route.useLoaderData();
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

	function onCreateAgenda(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = new FormData(e.currentTarget);
		return run(async () => {
			const agenda = await createAgenda({
				data: {
					boardId: board.id,
					templateId: String(f.get("templateId")),
					title: String(f.get("title")),
					meetingAt: String(f.get("meetingAt")),
					location: String(f.get("location")),
				},
			});
			await router.navigate({
				to: "/styrelser/$boardId/dagordningar/$agendaId",
				params: { boardId: board.id, agendaId: agenda.id },
			});
		});
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
				<Link to="/styrelser">Styrelser</Link>
			</nav>
			<h1>{board.name}</h1>
			{error && <p role="alert">{error}</p>}

			<section aria-labelledby="agendas">
				<h2 id="agendas">Dagordningar</h2>
				{agendas.length === 0 ? (
					<p>Inga dagordningar ännu.</p>
				) : (
					<ul>
						{agendas.map((a) => (
							<li key={a.id}>
								<Link
									to="/styrelser/$boardId/dagordningar/$agendaId"
									params={{ boardId: board.id, agendaId: a.id }}
								>
									{a.title}
								</Link>
								{a.meetingAt && (
									<>
										{" "}
										<time dateTime={a.meetingAt}>
											{formatMeetingAt(a.meetingAt)}
										</time>
									</>
								)}
							</li>
						))}
					</ul>
				)}

				<h3>Ny dagordning</h3>
				<form onSubmit={onCreateAgenda}>
					<p>
						<label htmlFor="templateId">Mall</label>
						<select id="templateId" name="templateId">
							{templates.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
							<option value="">Ingen mall (tom dagordning)</option>
						</select>
					</p>
					<p>
						<label htmlFor="title">Rubrik</label>
						<input
							id="title"
							name="title"
							defaultValue="Styrelsemöte"
							required
						/>
					</p>
					<p>
						<label htmlFor="meetingAt">Datum och tid</label>
						<input id="meetingAt" name="meetingAt" type="datetime-local" />
					</p>
					<p>
						<label htmlFor="location">Plats</label>
						<input id="location" name="location" />
					</p>
					<button type="submit">Skapa dagordning</button>
				</form>
			</section>

			<section aria-labelledby="protocols">
				<h2 id="protocols">Protokoll</h2>
				{protocols.length === 0 ? (
					<p>Inga protokoll ännu. Skapa ett från en dagordning.</p>
				) : (
					<ul>
						{protocols.map((p) => (
							<li key={p.id}>
								<Link
									to="/styrelser/$boardId/protokoll/$protocolId"
									params={{ boardId: board.id, protocolId: p.id }}
								>
									{p.title}
								</Link>
								{p.meetingAt && (
									<>
										{" "}
										<time dateTime={p.meetingAt}>
											{formatMeetingAt(p.meetingAt)}
										</time>
									</>
								)}
							</li>
						))}
					</ul>
				)}
			</section>

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
