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
import { Main } from "#/components/Main";
import { logIn } from "#/server/auth.functions";
import { Section } from "#/components/Section";
import { LinkButton } from "#/components/LinkButton";

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
			<form onSubmit={onSubmit} className="block space-y-5">
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
				<Button type="submit" disabled={pending}>
					Logga in
          </Button>
          <LinkButton to="/glomt-losenord">Glömt lösenordet?</LinkButton>
			</form>
      </Section>
		</Main>
	);
}
