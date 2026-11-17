import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { Form } from "#/components/Form";
import { LinkButton } from "#/components/LinkButton";
import { Main } from "#/components/Main";
import { Section } from "#/components/Section";
import { logIn } from "#/server/auth.functions";

export const Route = createFileRoute("/logga-in")({
	beforeLoad: ({ context }) => {
		if (context.user) throw redirect({ to: "/" });
	},
	component: LogIn,
});

function LogIn() {
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
			await logIn({
				data: {
					email: String(form.get("email")),
					password: String(form.get("password")),
				},
			});
			await router.invalidate();
			await router.navigate({ to: "/" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
			setPending(false);
		}
	}

	return (
		<Main>
			<Section id="logga-in" title="Logga in">
				<Form onSubmit={onSubmit}>
					<Field id="email" label="E-post">
						<Input name="email" type="email" autoComplete="email" required />
					</Field>
					<Field id="password" label="Lösenord">
						<Input
							name="password"
							type="password"
							autoComplete="current-password"
							required
						/>
					</Field>
					<ErrorMessage error={error} />
					<Button icon="log-in" type="submit" aria-busy={pending}>
						Logga in
					</Button>
					<LinkButton icon="help-circle" to="/glomt-losenord">
						Glömt lösenordet?
					</LinkButton>
				</Form>
			</Section>
		</Main>
	);
}
