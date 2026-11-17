import { createElement } from "react";
import { ICONS, type IconName } from "./icons.gen";

export type { IconName };

/**
 * A Feather icon (https://feathericons.com), as big as the text around it
 * and in its colour. Decorative: whatever it sits in carries the meaning.
 * The available icons are listed in scripts/generate-icons.mjs.
 */
export function Icon({
	name,
	className = "size-[1.1em]",
}: {
	name: IconName;
	/** Size and spacing; defaults to a little over the text size. */
	className?: string;
}) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={`inline-block shrink-0 align-[-0.15em] ${className}`}
		>
			{ICONS[name].map(([tag, attrs], i) =>
				createElement(tag, { key: i, ...attrs }),
			)}
		</svg>
	);
}
