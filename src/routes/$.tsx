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

/**
 * The page's text on a card: white, or dark in dark mode (bg-surface), so
 * it reads well on any background. Styles for the elements Markdown makes,
 * which Tailwind's base styles leave plain (no heading sizes, no bullets).
 */
const PAGE_TEXT = [
	"space-y-4 rounded-2xl border border-line-faint bg-surface p-4 leading-relaxed shadow-2xs sm:p-6",
	// Headings: room above, and kept clear of the top when linked to
	"[&_h2]:pt-4 [&_h2]:text-2xl [&_h2]:font-semibold [&>h2:first-child]:pt-0",
	"[&_h3]:pt-2 [&_h3]:text-xl [&_h3]:font-semibold",
	"[&_h4]:font-semibold [&_:is(h2,h3,h4)]:scroll-mt-4",
	// Lists
	"[&_ul]:list-disc [&_ol]:list-decimal [&_:is(ul,ol)]:space-y-1 [&_:is(ul,ol)]:pl-6",
	"[&_li::marker]:text-muted [&_li>:is(ul,ol)]:mt-1",
	// Quotes, code, rules
	"[&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:text-muted",
	"[&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:text-[0.9em]",
	"[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-muted [&_pre]:p-3 [&_pre_code]:p-0",
	"[&_hr]:border-line",
	// Tables
	"[&_table]:w-full [&_table]:border-collapse [&_:is(th,td)]:border [&_:is(th,td)]:border-line [&_:is(th,td)]:px-2 [&_:is(th,td)]:py-1 [&_:is(th,td)]:text-left [&_th]:bg-surface-muted [&_th]:font-semibold",
].join(" ");

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
			<article className="space-y-2.5">
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
					className={PAGE_TEXT}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML comes from our own Markdown files in content/sidor/, never from users
					dangerouslySetInnerHTML={{ __html: page.html }}
				/>
			</article>
		</Main>
	);
}
