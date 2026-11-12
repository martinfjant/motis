import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
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
			<main className="mx-auto w-4/5 space-y-2.5 p-4">
				<h1>Skapa konto</h1>
				<p>Det går inte att skapa konton just nu.</p>
			</main>
		);

	return (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>Skapa konto</h1>
			{policy.kind === "password" && (
				<p>
					BRF-protokoll är inte öppet för alla ännu. För att skapa ett konto
					behöver du lösenordet du har fått av oss.
				</p>
			)}
			<form onSubmit={onSubmit}>
				{policy.kind === "password" && (
					<Field id="signupPassword" label="Lösenord för att skapa konto">
						<Input
							name="signupPassword"
							type="password"
							autoComplete="off"
							required
						/>
					</Field>
				)}
				<Field id="name" label="Namn">
					<Input name="name" autoComplete="name" required />
				</Field>
				<Field id="email" label="E-post">
					<Input name="email" type="email" autoComplete="email" required />
				</Field>
				<Field id="password" label="Välj ett lösenord för ditt konto">
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
