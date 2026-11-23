import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Field, Input } from "#/components/Field";
import { Form } from "#/components/Form";
import { Main } from "#/components/Main";
import { PageHeader } from "#/components/PageHeader";
import { Panel } from "#/components/Panel";
import { requestPasswordReset } from "#/server/auth.functions";

export const Route = createFileRoute("/glomt-losenord")({
	head: () => ({ meta: [{ title: "Glömt lösenordet – Mötis" }] }),
	component: ForgotPassword,
});

function ForgotPassword() {
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (pending) return; // already saving: ignore a second press
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
			<Main>
				<PageHeader title="Kolla din e-post">
					<p>
						Om det finns ett konto med {sentTo} har vi skickat ett mejl med en
						länk för att välja ett nytt lösenord. Länken fungerar i en timme.
					</p>
					<p>
						Inget mejl? Titta i skräpposten, eller{" "}
						<Button onClick={() => setSentTo(null)}>försök igen</Button>
					</p>
				</PageHeader>
			</Main>
		);

	return (
		<Main>
			<PageHeader title="Glömt lösenordet?">
				<p>
					Skriv e-postadressen du loggar in med, så skickar vi en länk där du
					kan välja ett nytt lösenord.
				</p>
			</PageHeader>
			<Panel>
				<Form onSubmit={onSubmit}>
					<Field id="email" label="E-post">
						<Input name="email" type="email" autoComplete="email" required />
					</Field>
					<ErrorMessage error={error} />
					<Button icon="mail" type="submit" aria-busy={pending}>
						Skicka länk
					</Button>
				</Form>
				<p>
					<Link to="/logga-in">Tillbaka till inloggningen</Link>
				</p>
			</Panel>
		</Main>
	);
}
