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
		<section
			aria-labelledby={id}
			{...props}
			className="bg-white rounded-2xl p-2.5"
		>
			<h2 id={id} className="text-2xl">
				{title}
			</h2>
			{children}
		</section>
	);
}
