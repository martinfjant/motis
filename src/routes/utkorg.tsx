import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";
import { Instant } from "#/components/DateTime";
import { ErrorMessage } from "#/components/ErrorMessage";
import { Section } from "#/components/Section";
import { clearOutbox, getOutbox, sendTestMail } from "#/server/mail.functions";

/**
 * The development outbox: every email the app has "sent", since nothing
 * leaves the machine in development. Doesn't exist in production.
 */
export const Route = createFileRoute("/utkorg")({
	head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
	loader: () => getOutbox(),
	component: Outbox,
});

function Outbox() {
	const mails = Route.useLoaderData();
	const { user } = Route.useRouteContext();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);

	async function run(action: () => Promise<unknown>) {
		setError(null);
		try {
			await action();
			await router.invalidate();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	return (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>Utkorg</h1>
			<p>
				Under utveckling skickas inga mejl. De hamnar här i stället, så att du
				kan läsa dem och följa länkarna i dem.
			</p>
			<ErrorMessage error={error} />
			<p>
				{user && (
					<Button onClick={() => run(() => sendTestMail())}>
						Skicka testmejl till mig
					</Button>
				)}
				{mails.length > 0 && (
					<Button
						onClick={() => {
							if (confirm("Ta bort alla mejl i utkorgen?"))
								run(() => clearOutbox());
						}}
					>
						Töm utkorgen
					</Button>
				)}
			</p>
			{mails.length === 0 ? (
				<p>Utkorgen är tom.</p>
			) : (
				mails.map((mail) => (
					<Section key={mail.id} id={`mail-${mail.id}`} title={mail.subject}>
						<dl>
							<dt>Till</dt>
							<dd>{mail.to}</dd>
							<dt>Skickat</dt>
							<dd>
								<Instant at={mail.createdAt} />
							</dd>
						</dl>
						<iframe
							title={`Mejlet ”${mail.subject}”`}
							// Links open in a new tab; nothing in the mail can run.
							srcDoc={mail.html.replace(
								"<head>",
								'<head><base target="_blank">',
							)}
							sandbox="allow-popups allow-popups-to-escape-sandbox"
							className="h-96 w-full rounded-lg border border-stone-300"
						/>
						<details>
							<summary>Textversion</summary>
							<pre className="whitespace-pre-wrap">{mail.text}</pre>
						</details>
					</Section>
				))
			)}
		</main>
	);
}
