import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/Button";

/**
 * The "Dela" section for an agenda or a protocol: the public link, copying it,
 * and replacing it so the old link stops working.
 */
export function ShareSection({
	path,
	intro,
	linkText,
	onRegenerate,
}: {
	/** Public path, e.g. "/dagordning/abc123". */
	path: string;
	intro: React.ReactNode;
	linkText: string;
	onRegenerate: () => Promise<unknown>;
}) {
	const router = useRouter();
	const [status, setStatus] = useState<string | null>(null);

	async function onCopy() {
		const url = `${window.location.origin}${path}`;
		try {
			await navigator.clipboard.writeText(url);
			setStatus("Länken är kopierad.");
		} catch {
			setStatus(`Kunde inte kopiera. Länken är: ${url}`);
		}
	}

	async function regenerate() {
		if (
			!confirm(
				"Skapa en ny länk? Den gamla länken slutar fungera för alla som har fått den.",
			)
		)
			return;
		await onRegenerate();
		await router.invalidate();
		setStatus("En ny länk har skapats. Den gamla fungerar inte längre.");
	}

	return (
		<section aria-labelledby="share">
			<h2 id="share">Dela</h2>
			{intro}
			<p>
				<a href={path}>{linkText}</a>
			</p>
			<p>
				<Button type="button" onClick={onCopy}>
					Kopiera länken
				</Button>{" "}
				<Button type="button" onClick={regenerate}>
					Skapa ny länk
				</Button>
			</p>
			{status && <output>{status}</output>}
		</section>
	);
}
