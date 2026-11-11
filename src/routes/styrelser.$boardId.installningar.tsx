import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Breadcrumbs } from "#/components/Breadcrumbs";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input, Select } from "#/components/Field";
import { Notice } from "#/components/Notice";
import { Section } from "#/components/Section";
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
	linkUnregistered,
	removeBoardMember,
	removeUnregistered,
	setBoardBackground,
	setMemberTitle,
	updateUnregistered,
} from "#/server/boards.functions";
import type { UnregisteredMember } from "#/server/boards.server";
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
	const { board, members, unregistered, currentUserId, templates } =
		Route.useLoaderData();
	const router = useRouter();
	const isAdmin = board.role === "admin";
	const [error, setError] = useState<string | null>(null);
	const [added, setAdded] = useState<string | null>(null);

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
		const person = readPerson(form);
		setAdded(null);
		return run(async () => {
			const { registered } = await addMember({
				data: { boardId: board.id, ...person },
			});
			setAdded(
				registered
					? "Personen hade ett konto och är nu med i styrelsen."
					: `${person.name.trim()} lades till utan konto.`,
			);
			form.reset();
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
			<Breadcrumbs>
				<Link to="/styrelser">Styrelser</Link>
				<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
					{board.name}
				</Link>
			</Breadcrumbs>
			<h1>Inställningar</h1>
			<ErrorMessage error={error} />

			<BackgroundSection
				boardId={board.id}
				current={board.background}
				canEdit={isAdmin}
			/>

			<Section id="templates" title="Mallar">
				{templates.length === 0 ? (
					<p>
						Inga mallar.{" "}
						<Button
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
						</Button>
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
					<Field id="templateName" label="Mallens namn">
						<Input name="templateName" required />
					</Field>
					<Button type="submit">Skapa tom mall</Button>
				</form>
			</Section>

			<Section id="members" title="Ledamöter">
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
								<Button
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
								</Button>
							)}
							{(isAdmin || m.userId === currentUserId) && (
								<Button type="button" onClick={() => onLeave(m.userId)}>
									{m.userId === currentUserId ? "Lämna styrelsen" : "Ta bort"}
								</Button>
							)}
						</li>
					))}
				</ul>

				{unregistered.length > 0 && (
					<>
						<h3>Utan konto</h3>
						<p>
							Kan väljas i närvaro och val i protokollen, men kan inte logga in.
						</p>
						<ul>
							{unregistered.map((m) => (
								<li key={m.id}>
									<UnregisteredRow
										boardId={board.id}
										member={m}
										canEdit={isAdmin}
										run={run}
									/>
								</li>
							))}
						</ul>
					</>
				)}
			</Section>

			{isAdmin && (
				<Section id="add-member" title="Lägg till ledamot">
					<p>
						Har personen ett konto med e-postadressen blir den ledamot direkt.
						Annars läggs den till utan konto, och då behövs namnet. Skapar den
						ett konto senare kan du koppla ihop dem här.
					</p>
					<form onSubmit={onAdd}>
						<PersonFields idPrefix="new-member" nameRequired={false} />
						<Button type="submit">Lägg till</Button>
					</form>
					{added && <Notice>{added}</Notice>}
				</Section>
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
		<Section id="background" title="Bakgrund">
			{!canEdit ? (
				<p>
					Styrelsens bakgrund: {name(current)}. Administratörer kan ändra den.
				</p>
			) : (
				<form onSubmit={onSubmit}>
					<Field id="pattern" label="Mönster">
						<Select
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
						</Select>
					</Field>
					<p>
						Bakgrunden visas direkt medan du väljer. Mönstren kommer från{" "}
						<a href="https://css-pattern.com">css-pattern.com</a> av Temani
						Afif.
					</p>
					<p>
						<Button type="submit" disabled={choice === current}>
							Spara bakgrund
						</Button>{" "}
						<Button
							type="button"
							disabled={choice === current}
							onClick={() => {
								setChoice(current);
								setPreview(current);
							}}
						>
							Ångra
						</Button>
					</p>
					{status && <Notice>{status}</Notice>}
				</form>
			)}
		</Section>
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
					<Button type="button" onClick={() => setEditing(true)}>
						{member.title ? "Ändra titel" : "Lägg till titel"}
					</Button>
				</>
			)}
		</span>
	);
}

function readPerson(form: HTMLFormElement) {
	const f = new FormData(form);
	return {
		name: String(f.get("name") ?? ""),
		email: String(f.get("email") ?? ""),
		title: String(f.get("title") ?? ""),
	};
}

/** Name, email and title, for adding or changing a member without account. */
function PersonFields({
	idPrefix,
	nameRequired,
	person,
}: {
	idPrefix: string;
	nameRequired: boolean;
	person?: { name: string; email: string; title: string };
}) {
	const id = (name: string) => `${idPrefix}-${name}`;
	return (
		<>
			<Field
				id={id("name")}
				label={
					<>
						Namn
						{nameRequired ? "" : " (behövs om personen inte har något konto)"}
					</>
				}
			>
				<Input
					name="name"
					autoComplete="off"
					maxLength={100}
					defaultValue={person?.name}
					required={nameRequired}
				/>
			</Field>
			<Field id={id("email")} label="E-postadress">
				<Input
					name="email"
					type="email"
					autoComplete="off"
					defaultValue={person?.email}
				/>
			</Field>
			<Field id={id("title")} label="Titel, t.ex. Sekreterare eller Kassör">
				<Input
					name="title"
					list={TITLE_LIST_ID}
					maxLength={60}
					defaultValue={person?.title}
				/>
			</Field>
		</>
	);
}

/** A member without an account; admins can change, remove or link them. */
function UnregisteredRow({
	boardId,
	member,
	canEdit,
	run,
}: {
	boardId: string;
	member: UnregisteredMember;
	canEdit: boolean;
	run: (action: () => Promise<unknown>, after?: () => void) => Promise<void>;
}) {
	const [editing, setEditing] = useState(false);
	const ref = { boardId, id: member.id };

	if (editing)
		return (
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const person = readPerson(e.currentTarget);
					run(
						() => updateUnregistered({ data: { ...ref, ...person } }),
						() => setEditing(false),
					);
				}}
			>
				<PersonFields idPrefix={member.id} nameRequired person={member} />
				<p>
					<Button type="submit">Spara</Button>{" "}
					<Button type="button" onClick={() => setEditing(false)}>
						Avbryt
					</Button>
				</p>
			</form>
		);

	return (
		<>
			{personLabel(member.name, member.title)}
			{member.email && (
				<>
					{" "}
					<small>{member.email}</small>
				</>
			)}
			{member.hasAccount && (
				<>
					{" "}
					<strong>Har nu ett konto.</strong>
				</>
			)}
			{canEdit && (
				<>
					{member.hasAccount && (
						<>
							{" "}
							<Button
								type="button"
								onClick={() => {
									if (
										confirm(
											`Gör ${member.name} till registrerad ledamot? Kontot med ${member.email} får då tillgång till styrelsen.`,
										)
									)
										run(() => linkUnregistered({ data: ref }));
								}}
							>
								Gör till registrerad ledamot
							</Button>
						</>
					)}{" "}
					<Button type="button" onClick={() => setEditing(true)}>
						Ändra
					</Button>{" "}
					<Button
						type="button"
						onClick={() => {
							if (confirm(`Ta bort ${member.name} från styrelsen?`))
								run(() => removeUnregistered({ data: ref }));
						}}
					>
						Ta bort
					</Button>
				</>
			)}
		</>
	);
}
