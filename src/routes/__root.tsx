import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useLocation,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { ConfirmProvider } from "#/components/ConfirmDialog";
import { NotFound } from "#/components/NotFound";
import { SearchField } from "#/components/SearchField";
import { UserMenu } from "#/components/UserMenu";
import { useBoardLook } from "#/components/useBoardLook";
import { DEFAULT_PATTERN } from "#/patterns";
import { getCurrentUser, logOut } from "#/server/auth.functions";
import { getFooterLinks } from "#/server/pages.functions";
import type { FooterLink } from "#/server/pages.server";
import patternsCss from "../patterns.css?url";
import tailwindCss from "../tailwind.css?url";

export const Route = createRootRoute({
	beforeLoad: async () => ({ user: await getCurrentUser() }),
	// The footer's links to the static pages. They only change with a new
	// version of the app, so they are fetched once.
	loader: async () => ({ footerLinks: await getFooterLinks() }),
	staleTime: Number.POSITIVE_INFINITY,
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
	// On the results page the field shows what was searched for.
	const searched = useLocation({
		select: (l) =>
			l.pathname === "/sok"
				? String((l.search as { q?: unknown }).q ?? "")
				: "",
	});

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
			{/* In the middle on wider screens; on phones it's under "Sök" in the menu. */}
			{user && (
				<SearchField
					key={searched}
					defaultValue={searched}
					className="mx-3 hidden w-full max-w-md content-center sm:my-5 md:block"
				/>
			)}
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
 * Links to the static pages marked "footer" (content/sidor/), on every
 * page. Read from the router's state rather than the root's loader data,
 * since the shell also renders when that data isn't there (an error).
 */
function SiteFooter() {
	const links = useRouterState({
		select: (s) =>
			(
				s.matches.find((m) => m.routeId === "__root__")?.loaderData as
					| { footerLinks?: FooterLink[] }
					| undefined
			)?.footerLinks ?? [],
	});
	if (links.length === 0) return null;
	return (
		<footer>
			<nav aria-label="Om Mötis">
				<ul>
					{links.map((l) => (
						<li key={l.path}>
							<Link to="/$" params={{ _splat: l.path }}>
								{l.title}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</footer>
	);
}

/** The background pattern of the board being viewed, if not the default. */
function useBoardPattern(): string | undefined {
	const { pattern } = useBoardLook();
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
					<SiteFooter />
				</ConfirmProvider>
				<Scripts />
			</body>
		</html>
	);
}
