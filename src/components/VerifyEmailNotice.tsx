import { useState } from "react";
import { resendVerification } from "#/server/auth.functions";
import { Button } from "./Button";
import { ErrorMessage } from "./ErrorMessage";
import { Notice } from "./Notice";

/**
 * Asks the user to confirm their address, with a way to get the link again.
 * Nothing once it is confirmed.
 */
export function VerifyEmailNotice({
	user,
}: {
	user: { email: string; emailVerified: boolean };
}) {
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	if (user.emailVerified) return null;

	return (
		<aside aria-label="Bekräfta e-postadress">
			<p>
				<strong>Bekräfta din e-postadress.</strong> Vi har skickat en länk till{" "}
				{user.email}. När den är bekräftad kopplas du automatiskt till styrelser
				som har lagt till dig med den adressen.
			</p>
			{sent ? (
				<Notice>Ett nytt mejl är skickat.</Notice>
			) : (
				<p>
					<Button
						onClick={async () => {
							setError(null);
							try {
								await resendVerification();
								setSent(true);
							} catch (err) {
								setError(
									err instanceof Error ? err.message : "Något gick fel.",
								);
							}
						}}
					>
						Skicka länken igen
					</Button>
				</p>
			)}
			<ErrorMessage error={error} />
		</aside>
	);
}
