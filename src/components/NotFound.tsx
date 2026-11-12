import { Link, useRouteContext } from "@tanstack/react-router";

/**
 * The page for addresses that don't exist (the server answers 404). Leads
 * back to the start page: "Mina föreningar" when logged in.
 */
export function NotFound() {
	const { user } = useRouteContext({ from: "__root__" });
	return (
		<main className="mx-auto w-4/5 space-y-2.5 p-4">
			<h1>Sidan finns inte</h1>
			<p>
				Adressen leder inte till någon sida. Den kan vara felstavad, eller så
				har sidan tagits bort.
			</p>
			<p>
				<Link to="/">{user ? "Till Mina föreningar" : "Till startsidan"}</Link>
			</p>
		</main>
	);
}
