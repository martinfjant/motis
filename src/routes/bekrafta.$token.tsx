import { createFileRoute, Link } from "@tanstack/react-router";
import { verifyEmail } from "#/server/auth.functions";

// The link in the confirmation email. Following it confirms the address.
export const Route = createFileRoute("/bekrafta/$token")({
	loader: ({ params }) => verifyEmail({ data: { token: params.token } }),
	head: () => ({
		meta: [
			{ name: "robots", content: "noindex, nofollow" },
			{ name: "referrer", content: "no-referrer" },
			{ title: "Bekräfta e-postadress – BRF-protokoll" },
		],
	}),
	component: Verify,
});

function Verify() {
	const result = Route.useLoaderData();
	const { user } = Route.useRouteContext();
	const home = (
		<p>
			<Link to="/">{user ? "Till Mina föreningar" : "Till startsidan"}</Link>
		</p>
	);

	if (!result)
		return (
			<main className="mx-auto w-4/5 space-y-2.5 p-4">
				<h1>Länken fungerar inte</h1>
				<p>
					Den kan redan ha använts, ha gått ut, eller gälla en e-postadress du
					inte längre har på kontot. Under Mitt konto ser du om adressen är
					bekräftad och kan få en ny länk.
				</p>
				{home}
			</main>
		);

	return (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>E-postadressen är bekräftad</h1>
			<p>Tack! Nu vet vi att mejlen når dig.</p>
			{result.joinedBoards.length > 0 && (
				<>
					<p>
						Du fanns med i en styrelse under den här adressen och är nu med med
						ditt konto:
					</p>
					<ul>
						{result.joinedBoards.map((name) => (
							<li key={name}>{name}</li>
						))}
					</ul>
				</>
			)}
			{home}
		</main>
	);
}
