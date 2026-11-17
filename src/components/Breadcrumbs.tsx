import { Children, type ReactNode } from "react";

/** The way back up, e.g. Mina föreningar › BRF Testgården. Pass the links as children. */
export function Breadcrumbs({ children }: { children: ReactNode }) {
	const links = Children.toArray(children);
	return (
		<nav aria-label="Brödsmula">
			{/* On glass like the page header, so it can be read on any background. */}
			<ol className="inline-flex [--color-link:var(--color-link-on-glass)] flex-wrap rounded-xl border border-glass-line bg-glass px-3 py-1 backdrop-blur-md">
				{links.map((link, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed list of links
					<li key={i}>
						{i > 0 && (
							<span aria-hidden="true" className="text-muted">
								&nbsp;›{" "}
							</span>
						)}
						{link}
					</li>
				))}
			</ol>
		</nav>
	);
}
