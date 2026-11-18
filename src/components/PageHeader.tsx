import type { ReactNode } from "react";
import { useBoardLook } from "./useBoardLook";

/**
 * The top of a page: its heading (the page's only h1) and any text that
 * introduces it. Breadcrumbs, notices and forms go outside it. On a board's
 * pages it shows the board's logo by the heading, and its banner picture,
 * if chosen, behind it.
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
	const { logo, banner } = useBoardLook();
	const content = (
		<div className="space-y-2.5 [--color-link:var(--color-link-on-glass)] rounded-2xl border border-glass-line bg-glass p-3 shadow-2xs sm:p-4 backdrop-blur-md">
			{context && <p>{context}</p>}
			<div className="flex items-center gap-3 sm:gap-4">
				{logo && (
					// Decorative: the board's name is in the heading or the line above.
					<img
						src={logo}
						alt=""
						className="h-12 w-auto max-w-24 shrink-0 rounded-md object-contain sm:h-16 sm:max-w-32"
					/>
				)}
				<h1 className="min-w-0 text-3xl font-semibold sm:text-4xl">{title}</h1>
			</div>
			{children}
		</div>
	);
	if (!banner) return <header>{content}</header>;
	// The picture fills the header; the heading sits on glass at its foot. An
	// <img>, not a CSS background: the security policy allows no inline styles.
	return (
		<header className="relative isolate overflow-hidden rounded-2xl shadow-2xs">
			<img
				src={banner}
				alt=""
				className="absolute inset-0 -z-10 h-full w-full object-cover"
			/>
			<div className="p-2 pt-28 sm:p-3 sm:pt-44">{content}</div>
		</header>
	);
}
