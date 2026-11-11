import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const { user } = Route.useRouteContext();
	return (
		<main>
			<h1>BRF-protokoll</h1>
			<p>Skapa dagordningar och protokoll för styrelsemöten.</p>
			{user ? (
				<p>
					<Link to="/styrelser">Gå till dina styrelser</Link>
				</p>
			) : (
				<p>
					<Link to="/registrera">Skapa konto</Link> eller{" "}
					<Link to="/logga-in">logga in</Link>.
				</p>
			)}
		</main>
	);
}
