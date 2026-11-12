import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { requestPasswordReset } from "#/server/auth.functions";

export const Route = createFileRoute("/glomt-losenord")({
	head: () => ({ meta: [{ title: "Glömt lösenordet – BRF-protokoll" }] }),
	component: ForgotPassword,
});

function ForgotPassword() {
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const email = String(new FormData(e.currentTarget).get("email"));
		setPending(true);
		setError(null);
		try {
			await requestPasswordReset({ data: { email } });
			setSentTo(email.trim());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		} finally {
			setPending(false);
		}
	}

	if (sentTo)
		return (
			<main className="mx-auto w-4/5 space-y-2.5 p-4">
				<h1>Kolla din e-post</h1>
				<p>
					Om det finns ett konto med {sentTo} har vi skickat ett mejl med en
					länk för att välja ett nytt lösenord. Länken fungerar i en timme.
				</p>
				<p>
					Inget mejl? Titta i skräpposten, eller{" "}
					<Button onClick={() => setSentTo(null)}>försök igen</Button>
				</p>
			</main>
		);

	return (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>Glömt lösenordet?</h1>
			<p>
				Skriv e-postadressen du loggar in med, så skickar vi en länk där du kan
				välja ett nytt lösenord.
			</p>
			<form onSubmit={onSubmit}>
				<Field id="email" label="E-post">
					<Input name="email" type="email" autoComplete="email" required />
				</Field>
				<ErrorMessage error={error} />
				<Button type="submit" disabled={pending}>
					Skicka länk
				</Button>
			</form>
			<p>
				<Link to="/logga-in">Tillbaka till inloggningen</Link>
			</p>
		</main>
	);
}
