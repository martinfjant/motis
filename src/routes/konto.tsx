import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { Notice } from "#/components/Notice";
import { Section } from "#/components/Section";
import { TitleForm, TitleSuggestions } from "#/components/TitleForm";
import { updateProfile } from "#/server/auth.functions";
import { getMyBoards, setMyTitle } from "#/server/boards.functions";

export const Route = createFileRoute("/konto")({
	beforeLoad: ({ context }) => {
		if (!context.user) throw redirect({ to: "/logga-in" });
		return { user: context.user };
	},
	loader: () => getMyBoards(),
	component: Account,
});

function Account() {
	const { user } = Route.useRouteContext();
	const boards = Route.useLoaderData();
	return (
		<main>
			<h1>Mitt konto</h1>
			<ProfileSection user={user} />
			<Section id="titles" title="Titlar i styrelser">
				{boards.length === 0 ? (
					<p>Du är inte med i någon styrelse ännu.</p>
				) : (
					<>
						<p>Din titel visas i styrelsens lista över ledamöter.</p>
						<TitleSuggestions />
						<ul>
							{boards.map((board) => (
								<li key={board.id}>
									<TitleRow
										boardId={board.id}
										boardName={board.name}
										title={board.title}
									/>
								</li>
							))}
						</ul>
					</>
				)}
			</Section>
		</main>
	);
}

function ProfileSection({ user }: { user: { name: string; email: string } }) {
	const router = useRouter();
	const [editing, setEditing] = useState(false);
	const [emailChanged, setEmailChanged] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const f = new FormData(e.currentTarget);
		setError(null);
		try {
			await updateProfile({
				data: {
					name: String(f.get("name")),
					email: String(f.get("email")),
					currentPassword: String(f.get("currentPassword") ?? ""),
				},
			});
			await router.invalidate();
			setEditing(false);
			setEmailChanged(false);
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	return (
		<Section id="profile" title="Dina uppgifter">
			{!editing ? (
				<>
					<dl>
						<dt>Namn</dt>
						<dd>{user.name}</dd>
						<dt>E-post</dt>
						<dd>{user.email}</dd>
					</dl>
					{saved && <Notice>Sparat.</Notice>}
					<p>
						<Button
							type="button"
							onClick={() => {
								setSaved(false);
								setEditing(true);
							}}
						>
							Ändra uppgifter
						</Button>
					</p>
				</>
			) : (
				<form onSubmit={onSubmit}>
					<Field id="name" label="Namn">
						<Input
							name="name"
							autoComplete="name"
							defaultValue={user.name}
							required
						/>
					</Field>
					<Field id="email" label="E-post">
						<Input
							name="email"
							type="email"
							autoComplete="email"
							defaultValue={user.email}
							required
							onChange={(e) =>
								setEmailChanged(
									e.currentTarget.value.trim().toLowerCase() !== user.email,
								)
							}
						/>
					</Field>
					{emailChanged && (
						<Field
							id="currentPassword"
							label="Nuvarande lösenord (krävs för att byta e-postadress)"
						>
							<Input
								name="currentPassword"
								type="password"
								autoComplete="current-password"
								required
							/>
						</Field>
					)}
					<ErrorMessage error={error} />
					<p>
						<Button type="submit">Spara</Button>{" "}
						<Button
							type="button"
							onClick={() => {
								setEditing(false);
								setEmailChanged(false);
								setError(null);
							}}
						>
							Avbryt
						</Button>
					</p>
				</form>
			)}
		</Section>
	);
}

function TitleRow({
	boardId,
	boardName,
	title,
}: {
	boardId: string;
	boardName: string;
	title: string;
}) {
	const router = useRouter();
	const [editing, setEditing] = useState(false);

	if (editing)
		return (
			<TitleForm
				id={`title-${boardId}`}
				label={`Din titel i ${boardName}`}
				title={title}
				onSave={async (value) => {
					await setMyTitle({ data: { boardId, title: value } });
					await router.invalidate();
					setEditing(false);
				}}
				onCancel={() => setEditing(false)}
			/>
		);

	return (
		<p>
			<Link to="/styrelser/$boardId" params={{ boardId }}>
				{boardName}
			</Link>
			: {title || <em>ingen titel</em>}{" "}
			<Button type="button" onClick={() => setEditing(true)}>
				{title ? "Ändra" : "Lägg till titel"}
			</Button>
		</p>
	);
}
