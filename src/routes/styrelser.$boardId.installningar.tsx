import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
	TITLE_LIST_ID,
	TitleForm,
	TitleSuggestions,
} from "#/components/TitleForm";
import { DEFAULT_PATTERN, PATTERNS } from "#/patterns";
import { createTemplate, getBoardOverview } from "#/server/agendas.functions";
import {
	addMember,
	changeMemberRole,
	getBoardDetails,
	removeBoardMember,
	setBoardBackground,
	setMemberTitle,
} from "#/server/boards.functions";
import { personLabel } from "#/server/items";

// Board settings: background, templates and members, kept off the overview so that
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
		const f = new FormData(form);
		const email = String(f.get("email"));
		const title = String(f.get("title") ?? "");
		return run(
			() => addMember({ data: { boardId: board.id, email, title } }),
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

			<BackgroundSection
				boardId={board.id}
				current={board.background}
				canEdit={isAdmin}
			/>

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
				<TitleSuggestions />
				<ul>
					{members.map((m) => (
						<li key={m.userId}>
							<MemberTitle
								boardId={board.id}
								member={m}
								canEdit={isAdmin || m.userId === currentUserId}
							/>{" "}
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
						<p>
							<label htmlFor="new-member-title">
								Titel, t.ex. Sekreterare eller Kassör
							</label>
							<input
								id="new-member-title"
								name="title"
								list={TITLE_LIST_ID}
								maxLength={60}
							/>
						</p>
						<button type="submit">Lägg till</button>
					</form>
				</section>
			)}
		</main>
	);
}

/** Shows a pattern on the page without saving it. */
function setPreview(pattern: string) {
	const html = document.documentElement;
	if (pattern === DEFAULT_PATTERN) delete html.dataset.pattern;
	else html.dataset.pattern = pattern;
}

/** Choosing the board's background, previewed on the page before saving. */
function BackgroundSection({
	boardId,
	current,
	canEdit,
}: {
	boardId: string;
	current: string;
	canEdit: boolean;
}) {
	const router = useRouter();
	const [choice, setChoice] = useState(current);
	const [status, setStatus] = useState<string | null>(null);
	const name = (id: string) =>
		id === DEFAULT_PATTERN
			? "Standard"
			: (PATTERNS.find((p) => p.id === id)?.name ?? id);

	// Leaving the page without saving puts the saved background back. Only on
	// leaving: when a save changes `current`, the root already shows it.
	const saved = useRef(current);
	saved.current = current;
	useEffect(() => () => setPreview(saved.current), []);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setStatus(null);
		try {
			await setBoardBackground({ data: { boardId, pattern: choice } });
			await router.invalidate();
			setStatus("Bakgrunden är sparad.");
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	return (
		<section aria-labelledby="background">
			<h2 id="background">Bakgrund</h2>
			{!canEdit ? (
				<p>
					Styrelsens bakgrund: {name(current)}. Administratörer kan ändra den.
				</p>
			) : (
				<form onSubmit={onSubmit}>
					<p>
						<label htmlFor="pattern">Mönster</label>
						<select
							id="pattern"
							name="pattern"
							value={choice}
							onChange={(e) => {
								setChoice(e.currentTarget.value);
								setPreview(e.currentTarget.value);
								setStatus(null);
							}}
						>
							<option value={DEFAULT_PATTERN}>Standard</option>
							{PATTERNS.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</p>
					<p>
						Bakgrunden visas direkt medan du väljer. Mönstren kommer från{" "}
						<a href="https://css-pattern.com">css-pattern.com</a> av Temani
						Afif.
					</p>
					<p>
						<button type="submit" disabled={choice === current}>
							Spara bakgrund
						</button>{" "}
						<button
							type="button"
							disabled={choice === current}
							onClick={() => {
								setChoice(current);
								setPreview(current);
							}}
						>
							Ångra
						</button>
					</p>
					{status && <output>{status}</output>}
				</form>
			)}
		</section>
	);
}

/** A member as "Namn (Titel)", with a way to change the title if allowed. */
function MemberTitle({
	boardId,
	member,
	canEdit,
}: {
	boardId: string;
	member: { userId: string; name: string; email: string; title: string };
	canEdit: boolean;
}) {
	const router = useRouter();
	const [editing, setEditing] = useState(false);

	if (editing)
		return (
			<TitleForm
				id={`title-${member.userId}`}
				label={`Titel för ${member.name}`}
				title={member.title}
				onSave={async (title) => {
					await setMemberTitle({
						data: { boardId, userId: member.userId, title },
					});
					await router.invalidate();
					setEditing(false);
				}}
				onCancel={() => setEditing(false)}
			/>
		);

	return (
		<span>
			{personLabel(member.name, member.title)} <small>{member.email}</small>
			{canEdit && (
				<>
					{" "}
					<button type="button" onClick={() => setEditing(true)}>
						{member.title ? "Ändra titel" : "Lägg till titel"}
					</button>
				</>
			)}
		</span>
	);
}
