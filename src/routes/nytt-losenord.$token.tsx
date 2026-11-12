import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { checkPasswordReset, resetPassword } from "#/server/auth.functions";

// The link in the "Välj ett nytt lösenord" email.
export const Route = createFileRoute("/nytt-losenord/$token")({
	loader: ({ params }) => checkPasswordReset({ data: { token: params.token } }),
	head: () => ({
		meta: [
			{ name: "robots", content: "noindex, nofollow" },
			{ name: "referrer", content: "no-referrer" },
			{ title: "Nytt lösenord – BRF-protokoll" },
		],
	}),
	component: NewPassword,
});

function NewPassword() {
	const valid = Route.useLoaderData();
	const { token } = Route.useParams();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const password = String(new FormData(e.currentTarget).get("password"));
		setPending(true);
		setError(null);
		try {
			await resetPassword({ data: { token, password } });
			await router.invalidate();
			await router.navigate({ to: "/" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
			setPending(false);
		}
	}

	if (!valid)
		return (
			<main className="mx-auto w-4/5 space-y-2.5 p-4">
				<h1>Länken fungerar inte längre</h1>
				<p>
					Länken har redan använts eller gått ut; den fungerar en gång och i en
					timme.
				</p>
				<p>
					<Link to="/glomt-losenord">Be om en ny länk</Link>
				</p>
			</main>
		);

	return (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>Välj ett nytt lösenord</h1>
			<p>Du loggas in med det nya lösenordet, och ut överallt annars.</p>
			<form onSubmit={onSubmit}>
				<Field id="password" label="Nytt lösenord" hint="Minst 8 tecken.">
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
					Spara lösenordet
				</Button>
			</form>
		</main>
	);
}
