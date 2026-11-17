import type { ReactNode } from "react";

/**
 * The top of a page: its heading (the page's only h1) and any text that
 * introduces it. Breadcrumbs, notices and forms go outside it.
 */
export function PageHeader({
	title,
	context,
	children,
}: {
	title: ReactNode;
	/** A line above the heading, e.g. the board's name on public pages. */
	context?: ReactNode;
	/** Text under the heading. */
	children?: ReactNode;
}) {
	return (
		<header className="space-y-2.5 [--color-link:var(--color-link-on-glass)] rounded-2xl border border-glass-line bg-glass p-4 shadow-2xs backdrop-blur-md">
			{context && <p>{context}</p>}
			<h1 className="text-4xl font-semibold">{title}</h1>
			{children}
		</header>
	);
}
