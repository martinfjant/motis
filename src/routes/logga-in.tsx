import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { logIn } from "#/server/auth.functions";

export const Route = createFileRoute("/logga-in")({
	beforeLoad: ({ context }) => {
		if (context.user) throw redirect({ to: "/styrelser" });
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
			await router.navigate({ to: "/styrelser" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
			setPending(false);
		}
	}

	return (
		<main>
			<h1>Logga in</h1>
			<form onSubmit={onSubmit}>
				<p>
					<label htmlFor="email">E-post</label>
					<input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						required
					/>
				</p>
				<p>
					<label htmlFor="password">Lösenord</label>
					<input
						id="password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
					/>
				</p>
				{error && <p role="alert">{error}</p>}
				<button type="submit" disabled={pending}>
					Logga in
				</button>
			</form>
		</main>
	);
}
