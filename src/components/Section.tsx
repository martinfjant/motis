import type { ComponentProps, ReactNode } from "react";

/** A part of a page with its own heading, which also names it. */
export function Section({
	id,
	title,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> & {
	/** Id of the heading; must be unique on the page. */
	id: string;
	title: ReactNode;
}) {
	return (
		<section aria-labelledby={id} {...props}>
			<h2 id={id}>{title}</h2>
			{children}
		</section>
	);
}
