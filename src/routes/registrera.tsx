import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { signUp } from "#/server/auth.functions";

export const Route = createFileRoute("/registrera")({
	beforeLoad: ({ context }) => {
		if (context.user) throw redirect({ to: "/styrelser" });
	},
	component: SignUp,
});

function SignUp() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		setPending(true);
		setError(null);
		try {
			await signUp({
				data: {
					name: String(form.get("name")),
					email: String(form.get("email")),
					password: String(form.get("password")),
				},
			});
			await router.invalidate();
			await router.navigate({ to: "/styrelser" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
			setPending(false);
		}
	}

	return (
		<main>
			<h1>Skapa konto</h1>
			<form onSubmit={onSubmit}>
				<Field id="name" label="Namn">
					<Input name="name" autoComplete="name" required />
				</Field>
				<Field id="email" label="E-post">
					<Input name="email" type="email" autoComplete="email" required />
				</Field>
				<Field id="password" label="Lösenord">
					<Input
						name="password"
						type="password"
						autoComplete="new-password"
						minLength={8}
						required
					/>
				</Field>
				<ErrorMessage error={error} />
				<Button type="submit" disabled={pending}>
					Skapa konto
				</Button>
			</form>
		</main>
	);
}
