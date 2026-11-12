import { Children, type ReactNode } from "react";

/** The way back up, e.g. Mina föreningar › BRF Testgården. Pass the links as children. */
export function Breadcrumbs({ children }: { children: ReactNode }) {
	const links = Children.toArray(children);
	return (
		<nav aria-label="Brödsmula">
			<ol>
				{links.map((link, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed list of links
					<li key={i}>
						{i > 0 && <span aria-hidden="true">› </span>}
						{link}
					</li>
				))}
			</ol>
		</nav>
	);
}
