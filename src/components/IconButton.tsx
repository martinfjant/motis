import type { ComponentProps } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * A small button showing only an icon. The label is what screen readers
 * read and what shows as a tooltip, so make it say what happens, e.g.
 * "Ändra titel för Anna Andersson".
 */
export function IconButton({
	label,
	icon,
	type = "button",
	...props
}: Omit<ComponentProps<"button">, "children"> & {
	label: string;
	icon: IconName;
}) {
	return (
		<button
			type={type}
			aria-label={label}
			title={label}
			className="inline-flex size-7 items-center justify-center rounded-md align-middle text-muted hover:bg-surface-strong hover:text-ink"
			{...props}
		>
			<Icon name={icon} className="size-4" />
		</button>
	);
}
