import { Link, useRouteContext } from "@tanstack/react-router";
import { PageHeader } from "#/components/PageHeader";
import { Main } from "./Main";

/**
 * The page for addresses that don't exist (the server answers 404). Leads
 * back to the start page: "Mina föreningar" when logged in.
 */
export function NotFound() {
	const { user } = useRouteContext({ from: "__root__" });
	return (
		<Main>
			<PageHeader title="Sidan finns inte">
				<p>
					Adressen leder inte till någon sida. Den kan vara felstavad, eller så
					har sidan tagits bort.
				</p>
				<p>
					<Link to="/">
						{user ? "Till Mina föreningar" : "Till startsidan"}
					</Link>
				</p>
			</PageHeader>
		</Main>
	);
}
