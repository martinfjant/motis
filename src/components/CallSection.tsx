import { useState } from "react";
import type { CallRecipient, SentCall } from "#/server/calls.server";
import { Button } from "./Button";
import { Instant } from "./DateTime";
import { ErrorMessage } from "./ErrorMessage";
import { Section } from "./Section";

/**
 * "Skicka kallelse": email the agenda, with the link to the shared agenda,
 * to everyone on the board; and when that has been done.
 */
export function CallSection({
	recipients,
	missing,
	sent,
	onSend,
}: {
	recipients: CallRecipient[];
	/** Names of those on the board without an email address. */
	missing: string[];
	/** Earlier kallelser, newest first. */
	sent: SentCall[];
	onSend: () => Promise<void>;
}) {
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [latest, ...earlier] = sent;
	const count = `${recipients.length} ${recipients.length === 1 ? "person" : "personer"}`;

	async function send(question: string) {
		if (!confirm(question)) return;
		setError(null);
		setPending(true);
		try {
			await onSend();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		} finally {
			setPending(false);
		}
	}

	return (
		<Section id="call" title="Kallelse">
			{latest ? (
				<p>
					<strong>Kallelsen är skickad</strong> <Instant at={latest.sentAt} />{" "}
					av {latest.sentByName} till {latest.recipients.length}{" "}
					{latest.recipients.length === 1 ? "person" : "personer"}.
				</p>
			) : (
				<p>
					Kallelsen skickas med e-post till alla i styrelsen som har en
					e-postadress, med dagordningen och länken till den delade
					dagordningen.
				</p>
			)}
			{recipients.length > 0 && (
				<details>
					<summary>Mottagare ({count})</summary>
					<ul>
						{recipients.map((r) => (
							<li key={r.email}>
								{r.name} ({r.email})
							</li>
						))}
					</ul>
				</details>
			)}
			{missing.length > 0 && (
				<p>
					{missing.join(", ")} saknar e-postadress och får ingen kallelse. Lägg
					till den under Inställningar.
				</p>
			)}
			{earlier.length > 0 && (
				<p>
					Skickad även{" "}
					{earlier.map((c, i) => (
						<span key={c.sentAt}>
							{i > 0 && ", "}
							<Instant at={c.sentAt} />
						</span>
					))}
					.
				</p>
			)}
			<ErrorMessage error={error} />
			{recipients.length > 0 && (
				<p>
					<Button
						disabled={pending}
						onClick={() =>
							send(
								latest
									? `Skicka kallelsen igen till ${count}? Det är bra om dagordningen har ändrats.`
									: `Skicka kallelsen till ${count}?`,
							)
						}
					>
						{latest ? "Skicka kallelsen igen" : "Skicka kallelse"}
					</Button>
				</p>
			)}
		</Section>
	);
}
