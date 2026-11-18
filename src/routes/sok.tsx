import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Main } from "#/components/Main";
import { PageHeader } from "#/components/PageHeader";
import { SearchField } from "#/components/SearchField";
import { Section } from "#/components/Section";
import { highlight, searchWords } from "#/search";
import { searchProtocols } from "#/server/search.functions";

/** Search results: protocols of one's boards, newest first. */
export const Route = createFileRoute("/sok")({
	validateSearch: (search: Record<string, unknown>) => ({
		q: typeof search.q === "string" ? search.q : "",
	}),
	beforeLoad: ({ context }) => {
		if (!context.user) throw redirect({ to: "/logga-in" });
	},
	loaderDeps: ({ search }) => ({ q: search.q }),
	loader: ({ deps }) => searchProtocols({ data: { q: deps.q } }),
	head: () => ({ meta: [{ title: "Sök – Mötis" }] }),
	component: SearchPage,
});

function SearchPage() {
	const { q } = Route.useSearch();
	const results = Route.useLoaderData();
	const words = searchWords(q);
	const hits = results.reduce((n, r) => n + Math.max(1, r.hits.length), 0);

	return (
		<Main>
			<PageHeader title="Sök i protokollen">
				{/* For phones, where the header has no room for it. */}
				<SearchField key={q} defaultValue={q} className="md:hidden" />
			</PageHeader>

			{q.trim() === "" ? null : results.length === 0 ? (
				<Section id="inga-traffar" title="Inga träffar">
					<p>
						Inget protokoll innehåller ”{q.trim()}”. Alla ord måste finnas med,
						så pröva med färre ord.
					</p>
				</Section>
			) : (
				<>
					<p aria-live="polite" className="px-1">
						{hits === 1 ? "1 träff" : `${hits} träffar`} i{" "}
						{results.length === 1
							? "1 protokoll"
							: `${results.length} protokoll`}
						.
					</p>
					{results.map((r) => (
						<Section
							key={r.protocolId}
							id={`traff-${r.protocolId}`}
							title={
								<>
									<Link
										to="/styrelser/$boardId/protokoll/$protocolId"
										params={{ boardId: r.boardId, protocolId: r.protocolId }}
									>
										<Marked text={r.title} words={words} />
									</Link>{" "}
									{r.date && (
										<span className="whitespace-nowrap text-muted">
											{r.date}
										</span>
									)}
								</>
							}
						>
							<p className="text-muted">{r.boardName}</p>
							{r.hits.length > 0 && (
								<ul className="list-disc space-y-2 pl-6">
									{r.hits.map((h) => (
										<li key={h.itemId}>
											<strong>
												<Marked text={h.itemTitle} words={words} />
											</strong>
											{h.excerpt && (
												<>
													: <Marked text={h.excerpt} words={words} />
												</>
											)}
										</li>
									))}
								</ul>
							)}
						</Section>
					))}
				</>
			)}
		</Main>
	);
}

/** The text with the searched words marked. */
function Marked({ text, words }: { text: string; words: string[] }) {
	return highlight(text, words).map((part, i) =>
		part.hit ? (
			// biome-ignore lint/suspicious/noArrayIndexKey: fixed parts of a text
			<mark key={i} className="rounded-sm bg-button text-on-button">
				{part.text}
			</mark>
		) : (
			part.text
		),
	);
}
