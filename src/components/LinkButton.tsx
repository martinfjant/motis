import { createLink } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { ButtonIcon, withButtonStyle } from "./Button";
import type { IconName } from "./Icon";

/**
 * A plain link that looks like a <Button>, for addresses outside the app's
 * pages: downloads (/api/…), other sites. For the app's own pages use
 * LinkButton. Classes passed in are added, not swapped in: the router gives
 * the current page's link className="active" (and aria-current="page").
 */
export function AnchorButton({
	className,
	icon,
	children,
	...props
}: ComponentProps<"a"> & { icon?: IconName }) {
	return (
		<a {...props} className={withButtonStyle(className)}>
			{icon && <ButtonIcon name={icon} />}
			{children}
		</a>
	);
}

/**
 * A link that looks like a <Button>. It is a router <Link> in every other
 * way, with the same props (to, params, search, activeProps…), so use it
 * for navigation; use <Button> for actions. The look comes from
 * buttonStyle in Button.tsx, so the two always match.
 */
export const LinkButton = createLink(AnchorButton);
