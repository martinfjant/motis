import type { ComponentProps } from "react";

/** The card that sections and panels sit on: frosted, so the background never shows through text. */
export const CARD =
	"rounded-2xl border border-glass-line bg-glass-strong p-3 sm:p-4 space-y-2.5 shadow-2xs backdrop-blur-md";

/**
 * A card without a heading of its own, for content the page's header
 * already names, such as the form on "Skapa konto". Use Section when the
 * part needs a heading.
 */
export function Panel(props: ComponentProps<"div">) {
	return <div {...props} className={CARD} />;
}
