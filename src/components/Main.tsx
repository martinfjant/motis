import type { ComponentProps } from "react";

/** A page's main content. Every page has exactly one. */
export function Main(props: ComponentProps<"main">) {
	return (
		<main {...props} className="mx-auto w-9/10 max-w-4xl space-y-2.5 p-4" />
	);
}
