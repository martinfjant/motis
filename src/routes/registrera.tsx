import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { Form } from "#/components/Form";
import { Main } from "#/components/Main";
import { PageHeader } from "#/components/PageHeader";
import { NewPasswordFields, PasswordInput } from "#/components/PasswordInput";
import { getSignupPolicy, signUp } from "#/server/auth.functions";

export const Route = createFileRoute("/registrera")({
	beforeLoad: ({ context }) => {
		if (context.user) throw redirect({ to: "/" });
	},
	loader: () => getSignupPolicy(),
	component: SignUp,
});

function SignUp() {
	const policy = Route.useLoaderData();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (pending) return; // already saving: ignore a second press
		const form = new FormData(e.currentTarget);
		setPending(true);
		setError(null);
		try {
			await signUp({
				data: {
					name: String(form.get("name")),
					email: String(form.get("email")),
					password: String(form.get("password")),
					signupPassword: String(form.get("signupPassword") ?? ""),
				},
			});
			await router.invalidate();
			await router.navigate({ to: "/" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
			setPending(false);
		}
	}

	if (policy.kind === "closed")
		return (
			<Main>
				<PageHeader title="Skapa konto">
					<p>Det går inte att skapa konton just nu.</p>
				</PageHeader>
			</Main>
		);

	return (
		<Main>
			<PageHeader title="Skapa konto">
				{policy.kind === "password" && (
					<p>
						Mötis är inte öppet för alla ännu. För att skapa ett konto behöver
						du lösenordet du har fått av oss.
					</p>
				)}
			</PageHeader>
			<Form onSubmit={onSubmit}>
				{policy.kind === "password" && (
					<Field id="signupPassword" label="Lösenord för att skapa konto">
						<PasswordInput name="signupPassword" autoComplete="off" required />
					</Field>
				)}
				<Field id="name" label="Namn">
					<Input name="name" autoComplete="name" required />
				</Field>
				<Field id="email" label="E-post">
					<Input name="email" type="email" autoComplete="email" required />
				</Field>
				<NewPasswordFields label="Välj ett lösenord för ditt konto" />
				<ErrorMessage error={error} />
				<Button icon="user-plus" type="submit" aria-busy={pending}>
					Skapa konto
				</Button>
			</Form>
		</Main>
	);
}
