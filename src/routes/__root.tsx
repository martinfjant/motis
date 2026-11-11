import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { getCurrentUser, logOut } from "#/server/auth.functions";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	beforeLoad: async () => ({ user: await getCurrentUser() }),
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "BRF-protokoll" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: RootDocument,
	component: () => <Outlet />,
});

function SiteHeader() {
	const { user } = Route.useRouteContext();
	const router = useRouter();

	async function handleLogOut(e: React.FormEvent) {
		e.preventDefault();
		await logOut();
		await router.invalidate();
		await router.navigate({ to: "/" });
	}

	return (
		<header>
			<Link to="/">BRF-protokoll</Link>
			<nav aria-label="Huvudmeny">
				{user ? (
					<ul>
						<li>
							<Link to="/styrelser">Styrelser</Link>
						</li>
						<li>
							<form onSubmit={handleLogOut}>
								<button type="submit">Logga ut ({user.name})</button>
							</form>
						</li>
					</ul>
				) : (
					<ul>
						<li>
							<Link to="/logga-in">Logga in</Link>
						</li>
						<li>
							<Link to="/registrera">Skapa konto</Link>
						</li>
					</ul>
				)}
			</nav>
		</header>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="sv">
			<head>
				<HeadContent />
			</head>
			<body>
				<SiteHeader />
				{children}
				<Scripts />
			</body>
		</html>
	);
}
