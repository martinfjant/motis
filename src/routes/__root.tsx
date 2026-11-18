import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useMatches,
	useRouter,
} from "@tanstack/react-router";
import { ConfirmProvider } from "#/components/ConfirmDialog";
import { NotFound } from "#/components/NotFound";
import { UserMenu } from "#/components/UserMenu";
import { DEFAULT_PATTERN } from "#/patterns";
import { getCurrentUser, logOut } from "#/server/auth.functions";
import patternsCss from "../patterns.css?url";
import tailwindCss from "../tailwind.css?url";

export const Route = createRootRoute({
	beforeLoad: async () => ({ user: await getCurrentUser() }),
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Mötis" },
		],
		links: [
			{ rel: "stylesheet", href: tailwindCss },
			// Board background patterns, chosen per board in its settings.
			{ rel: "stylesheet", href: patternsCss },
		],
	}),
	shellComponent: RootDocument,
	component: () => <Outlet />,
	notFoundComponent: NotFound,
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
		<header className="flex flex-row justify-between">
			<div className="content-center m-3 sm:m-5">
				{/*
				 * The name, not a link like the others: the button yellow, with a
				 * soft shadow so it can be read on light parts of the background too.
				 */}
				<Link
					to="/"
					className="text-3xl font-bold text-button sm:text-4xl no-underline [text-shadow:0_1px_3px_rgb(0_0_0/0.55)] hover:bg-transparent hover:text-button hover:underline hover:shadow-none active:bg-transparent active:shadow-none"
				>
					Mötis
				</Link>
			</div>
			<nav
				aria-label="Huvudmeny"
				className="m-3 flex rounded-xl border sm:m-5 border-glass-line bg-glass shadow-2xs backdrop-blur-md [--color-link:var(--color-link-on-glass)]"
			>
				{user ? (
					<UserMenu name={user.name} onLogOut={handleLogOut} />
				) : (
					<ul className="flex items-center gap-4 px-5">
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
				<ConfirmProvider>
					<SiteHeader />
					{children}
				</ConfirmProvider>
				<Scripts />
			</body>
		</html>
	);
}
