import type { ComponentProps } from "react";

/** A page's main content. Every page has exactly one. */
export function Main(props: ComponentProps<"main">) {
	return (
		<main
			{...props}
			className="mx-auto w-full max-w-4xl space-y-2.5 px-2 py-4 sm:w-9/10 sm:p-4"
		/>
	);
}
