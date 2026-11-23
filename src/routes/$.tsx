import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { Main } from "#/components/Main";
import { PageHeader } from "#/components/PageHeader";
import { getPage } from "#/server/pages.functions";

/**
 * The static pages written in Markdown (content/sidor/, see
 * src/server/pages.server.ts), at their own addresses: /integritet,
 * /hjalp/moten. Catches every address no other route has, so an address
 * that isn't a page either gets the usual "Sidan finns inte" and a 404.
 */
export const Route = createFileRoute("/$")({
	loader: async ({ params }) => {
		const page = await getPage({ data: { path: params._splat ?? "" } });
		if (!page) throw notFound();
		return page;
	},
	head: ({ loaderData }) => ({
		meta: loaderData
			? [
					{ title: `${loaderData.title} – Mötis` },
					...(loaderData.description
						? [{ name: "description", content: loaderData.description }]
						: []),
				]
			: [],
	}),
	component: StaticPage,
});

function StaticPage() {
	const page = Route.useLoaderData();
	const router = useRouter();

	// The Markdown's links are plain <a>s; links within the site are followed
	// the way the app's own links are, without loading the whole page again.
	// A click with a modifier key (new tab, new window) is left alone.
	function onClick(e: React.MouseEvent) {
		const link = (e.target as Element).closest("a");
		if (
			!link ||
			e.defaultPrevented ||
			e.button !== 0 ||
			e.metaKey ||
			e.ctrlKey ||
			e.shiftKey ||
			e.altKey ||
			link.target ||
			link.hasAttribute("download") ||
			link.origin !== location.origin
		)
			return;
		e.preventDefault();
		router.navigate({ href: link.pathname + link.search + link.hash });
	}

	return (
		<Main>
			<article>
				<PageHeader title={page.title}>
					{page.updated && (
						<p>
							Senast uppdaterad{" "}
							<time dateTime={page.updated}>
								{page.updated.split("-").reverse().join("-")}
							</time>
						</p>
					)}
				</PageHeader>
				{/* Only catches clicks bubbling up from the links inside. */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: the links themselves are what is clicked and focused */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: Enter on a link is a click, so the keyboard is covered */}
				<div
					onClick={onClick}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML comes from our own Markdown files in content/sidor/, never from users
					dangerouslySetInnerHTML={{ __html: page.html }}
				/>
			</article>
		</Main>
	);
}
