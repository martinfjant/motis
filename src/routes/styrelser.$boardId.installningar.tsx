import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BoardImagesSection } from "#/components/BoardImagesSection";
import { Breadcrumbs } from "#/components/Breadcrumbs";
import { Button } from "#/components/Button";
import { useConfirm } from "#/components/ConfirmDialog";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input, Select } from "#/components/Field";
import { Form } from "#/components/Form";
import { IconButton } from "#/components/IconButton";
import { Main } from "#/components/Main";
import { Notice } from "#/components/Notice";
import { PageHeader } from "#/components/PageHeader";
import { Section } from "#/components/Section";
import { Cell, RowHeader, Table } from "#/components/Table";
import { TITLE_LIST_ID, TitleSuggestions } from "#/components/TitleForm";
import { useFocusMessage } from "#/components/useFocusMessage";
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
		<Main>
			<PageHeader title="Styrelsen hittades inte">
				<p>
					<Link to="/">Tillbaka till Mina föreningar</Link>
				</p>
			</PageHeader>
		</Main>
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
		if (userId === currentUserId) await router.navigate({ to: "/" });
	}

	return (
		<Main>
			<Breadcrumbs>
				<Link to="/">Mina föreningar</Link>
				<Link to="/styrelser/$boardId" params={{ boardId: board.id }}>
					{board.name}
				</Link>
			</Breadcrumbs>
			<PageHeader title="Inställningar" />
			<ErrorMessage error={error} />

			<BackgroundSection
				boardId={board.id}
				current={board.background}
				canEdit={isAdmin}
			/>
			<BoardImagesSection
				boardId={board.id}
				logo={board.logo}
				banner={board.banner}
				canEdit={isAdmin}
			/>

			<Section id="templates" title="Mallar">
				{templates.length === 0 ? (
					<p>
						Inga mallar.{" "}
						<Button
							icon="plus"
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
					<ul className="list-disc pl-6">
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
				<Form onSubmit={onCreateTemplate}>
					<Field id="templateName" label="Mallens namn">
						<Input name="templateName" required />
					</Field>
					<Button icon="file-plus" type="submit">
						Skapa tom mall
					</Button>
				</Form>
			</Section>

			<Section id="members" title="Ledamöter">
				<TitleSuggestions />
				<Table
					caption="Med konto"
					columns={["Namn", "Titel", "E-postadress", "Roll", "Åtgärder"]}
				>
					{members.map((m) => (
						<MemberRow
							key={m.userId}
							boardId={board.id}
							member={m}
							isAdmin={isAdmin}
							isSelf={m.userId === currentUserId}
							run={run}
							onLeave={() => onLeave(m.userId)}
						/>
					))}
				</Table>

				{unregistered.length > 0 && (
					<>
						<p className="mt-6 text-muted">
							Ledamöter utan konto kan väljas i närvaro och val i protokollen,
							men kan inte logga in.
						</p>
						<Table
							caption="Utan konto"
							columns={[
								"Namn",
								"Titel",
								"E-postadress",
								...(isAdmin ? ["Åtgärder"] : []),
							]}
						>
							{unregistered.map((m) => (
								<UnregisteredRow
									key={m.id}
									boardId={board.id}
									member={m}
									canEdit={isAdmin}
									run={run}
								/>
							))}
						</Table>
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
					<Form onSubmit={onAdd}>
						<PersonFields idPrefix="new-member" nameRequired={false} />
						<Button icon="plus" type="submit">
							Lägg till
						</Button>
					</Form>
					{added && <Notice>{added}</Notice>}
				</Section>
			)}
		</Main>
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
	// Pressing Spara or Ångra with nothing changed says so (instead of
	// disabled buttons).
	const nothing = useFocusMessage();
	const [nothingText, setNothingText] = useState("");
	const nothingToDo = (text: string) => {
		setNothingText(text);
		nothing.show();
	};
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
		if (choice === current) {
			nothingToDo("Inget att spara. Välj ett annat mönster först.");
			return;
		}
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
				<Form onSubmit={onSubmit}>
					<Field id="pattern" label="Mönster">
						<Select
							name="pattern"
							value={choice}
							onChange={(e) => {
								setChoice(e.currentTarget.value);
								setPreview(e.currentTarget.value);
								setStatus(null);
								nothing.hide();
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
						<Button icon="save" type="submit">
							Spara bakgrund
						</Button>{" "}
						<Button
							icon="rotate-ccw"
							type="button"
							onClick={() => {
								if (choice === current) return nothingToDo("Inget att ångra.");
								setChoice(current);
								setPreview(current);
							}}
						>
							Ångra
						</Button>
					</p>
					{nothing.shown && (
						<p
							ref={nothing.ref}
							tabIndex={-1}
							className="font-medium outline-none"
						>
							{nothingText}
						</p>
					)}
					{status && <Notice>{status}</Notice>}
				</Form>
			)}
		</Section>
	);
}

// Row buttons, smaller than elsewhere so a row's actions fit side by side.
const ACTIONS =
	"flex flex-wrap items-center gap-1 [&_button]:mr-0 [&_button]:px-2 [&_button]:py-0.5 [&_button]:text-sm [&_button]:whitespace-nowrap";

/** An email address that may wrap after the @, but nowhere else. */
function Email({ address }: { address: string }) {
	const at = address.indexOf("@");
	if (at === -1) return address;
	return (
		<>
			{address.slice(0, at)}
			<wbr />
			{address.slice(at)}
		</>
	);
}

type Run = (
	action: () => Promise<unknown>,
	after?: () => void,
) => Promise<void>;

/**
 * A member with an account. Their title can be changed by them and by
 * admins, and their role by admins, each with a pen next to it that opens
 * the field in place.
 */
function MemberRow({
	boardId,
	member,
	isAdmin,
	isSelf,
	run,
	onLeave,
}: {
	boardId: string;
	member: {
		userId: string;
		name: string;
		email: string;
		title: string;
		role: string;
	};
	isAdmin: boolean;
	isSelf: boolean;
	run: Run;
	onLeave: () => void;
}) {
	const [editing, setEditing] = useState<"title" | "role" | null>(null);
	const canEditTitle = isAdmin || isSelf;
	const roleName = (role: string) =>
		role === "admin" ? "Administratör" : "Ledamot";

	return (
		<tr>
			<RowHeader>{member.name}</RowHeader>
			<Cell label="Titel">
				{editing === "title" ? (
					<form
						aria-label={`Titel för ${member.name}`}
						className="inline-flex flex-wrap items-center gap-1"
						onSubmit={(e) => {
							e.preventDefault();
							const title = String(
								new FormData(e.currentTarget).get("title") ?? "",
							);
							run(
								() =>
									setMemberTitle({
										data: { boardId, userId: member.userId, title },
									}),
								() => setEditing(null),
							);
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") setEditing(null);
						}}
					>
						<label htmlFor={`title-${member.userId}`} className="sr-only">
							Titel för {member.name}
						</label>
						<input
							id={`title-${member.userId}`}
							name="title"
							list={TITLE_LIST_ID}
							maxLength={60}
							defaultValue={member.title}
							// biome-ignore lint/a11y/noAutofocus: opened on purpose with the pen
							autoFocus
							className="w-28 rounded-md border border-line-strong px-1 text-sm bg-field"
						/>
						<IconButton type="submit" label="Spara titel" icon="check" />
						<IconButton
							label="Avbryt"
							icon="x"
							onClick={() => setEditing(null)}
						/>
					</form>
				) : (
					<span className="inline-flex items-center gap-1">
						{member.title}
						{canEditTitle && (
							<IconButton
								label={`${member.title ? "Ändra" : "Lägg till"} titel för ${member.name}`}
								icon="edit-2"
								onClick={() => setEditing("title")}
							/>
						)}
					</span>
				)}
			</Cell>
			<Cell label="E-postadress" className="text-sm text-muted">
				<Email address={member.email} />
			</Cell>
			<Cell label="Roll">
				{editing === "role" ? (
					<span className="inline-flex items-center gap-1">
						<label htmlFor={`role-${member.userId}`} className="sr-only">
							Roll för {member.name}
						</label>
						{/* Choosing a role saves it straight away. */}
						<select
							id={`role-${member.userId}`}
							defaultValue={member.role}
							className="rounded-md border border-line-strong px-1 text-sm bg-field"
							onChange={(e) => {
								const role = e.currentTarget.value;
								run(
									() =>
										changeMemberRole({
											data: { boardId, userId: member.userId, role },
										}),
									() => setEditing(null),
								);
							}}
						>
							<option value="member">{roleName("member")}</option>
							<option value="admin">{roleName("admin")}</option>
						</select>
						<IconButton
							label="Avbryt"
							icon="x"
							onClick={() => setEditing(null)}
						/>
					</span>
				) : (
					<span className="inline-flex items-center gap-1">
						<span
							className={`rounded-full px-2 py-0.5 text-sm whitespace-nowrap ${
								member.role === "admin"
									? "bg-info text-on-info"
									: "bg-surface-muted text-ink"
							}`}
						>
							{roleName(member.role)}
						</span>
						{isAdmin && (
							<IconButton
								label={`Ändra roll för ${member.name}`}
								icon="edit-2"
								onClick={() => setEditing("role")}
							/>
						)}
					</span>
				)}
			</Cell>
			<Cell label="Åtgärder">
				{(isAdmin || isSelf) && (
					<div className={ACTIONS}>
						<Button
							icon={isSelf ? "log-out" : "trash-2"}
							type="button"
							onClick={onLeave}
						>
							{isSelf ? "Lämna styrelsen" : "Ta bort"}
						</Button>
					</div>
				)}
			</Cell>
		</tr>
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
	run: Run;
}) {
	const confirm = useConfirm();
	const [editing, setEditing] = useState(false);
	const ref = { boardId, id: member.id };

	// A form can't span table cells, so while editing the row is one wide
	// cell holding the form.
	if (editing)
		return (
			<tr>
				<Cell colSpan={4}>
					<Form
						aria-label={`Ändra ${member.name}`}
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
							<Button icon="save" type="submit">
								Spara
							</Button>
							<Button icon="x" type="button" onClick={() => setEditing(false)}>
								Avbryt
							</Button>
						</p>
					</Form>
				</Cell>
			</tr>
		);

	return (
		<tr>
			<RowHeader>
				{member.name}
				{/* Registered since with the same email: can be linked. */}
				{member.hasAccount && (
					<>
						{" "}
						<small className="ml-1 rounded-full bg-warn px-2 py-0.5 font-normal whitespace-nowrap text-on-warn">
							har nu ett konto
						</small>
					</>
				)}
			</RowHeader>
			<Cell label="Titel">{member.title}</Cell>
			<Cell label="E-postadress" className="text-sm text-muted">
				<Email address={member.email} />
			</Cell>
			{canEdit && (
				<Cell label="Åtgärder">
					<div className={ACTIONS}>
						{member.hasAccount && (
							<Button
								icon="user-check"
								type="button"
								onClick={async () => {
									if (
										await confirm({
											title: `Gör ${member.name} till registrerad ledamot?`,
											message: `Kontot med ${member.email} får då tillgång till styrelsen.`,
											confirmLabel: "Gör till registrerad ledamot",
											confirmIcon: "user-check",
										})
									)
										run(() => linkUnregistered({ data: ref }));
								}}
							>
								Gör till registrerad ledamot
							</Button>
						)}
						<Button
							icon="edit-2"
							type="button"
							onClick={() => setEditing(true)}
						>
							Ändra
						</Button>
						<Button
							icon="trash-2"
							type="button"
							onClick={async () => {
								if (
									await confirm({
										title: `Ta bort ${member.name} från styrelsen?`,
										confirmLabel: "Ta bort",
										confirmIcon: "trash-2",
									})
								)
									run(() => removeUnregistered({ data: ref }));
							}}
						>
							Ta bort
						</Button>
					</div>
				</Cell>
			)}
		</tr>
	);
}
