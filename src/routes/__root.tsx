import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useMatches,
	useRouter,
} from "@tanstack/react-router";
import { Button } from "#/components/Button";
import { DEFAULT_PATTERN } from "#/patterns";
import { getCurrentUser, logOut } from "#/server/auth.functions";
import patternsCss from "../patterns.css?url";
import appCss from "../styles.css?url";
import tailwindCss from "../tailwind.css?url";

export const Route = createRootRoute({
	beforeLoad: async () => ({ user: await getCurrentUser() }),
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "BRF-protokoll" },
		],
		links: [
			{ rel: "stylesheet", href: tailwindCss },
			{ rel: "stylesheet", href: appCss },
			// Board background patterns, chosen per board in its settings.
			{ rel: "stylesheet", href: patternsCss },
		],
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
							<Link to="/konto">Mitt konto</Link>
						</li>
						<li>
							<form onSubmit={handleLogOut}>
								<Button type="submit">Logga ut ({user.name})</Button>
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

/**
 * The background pattern of the board being viewed, if any. Board pages (and
 * the public agenda) return the board in their loader data.
 */
function useBoardPattern(): string | undefined {
	const backgrounds = useMatches({
		select: (matches) =>
			matches.map(
				(m) =>
					(m.loaderData as { board?: { background?: unknown } } | undefined)
						?.board?.background,
			),
	});
	const pattern = [...backgrounds]
		.reverse()
		.find((b): b is string => typeof b === "string");
	return pattern && pattern !== DEFAULT_PATTERN ? pattern : undefined;
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const pattern = useBoardPattern();
	return (
		<html lang="sv" data-pattern={pattern}>
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
