import type { ComponentProps } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * How buttons look. Shared with LinkButton, so a link styled as a button
 * always looks the same as a real one: change it here for both.
 * inline-block is what a <button> already is; links need it to match.
 */
export const buttonStyle =
	"inline-block rounded-lg px-3 py-1 text-lg mr-3 no-underline text-on-button bg-button border-button-line border shadow hover:bg-accent hover:border-accent-line hover:shadow-lg hover:text-on-accent hover:scale-102 transition-all active:bg-accent-pressed active:scale-99 disabled:pointer-events-none disabled:opacity-50";

/** The icon at the start of a button or a link styled as one. */
export function ButtonIcon({ name }: { name: IconName }) {
	return <Icon name={name} className="mr-2 size-[1.1em]" />;
}

/** buttonStyle plus any classes given for one button or link. */
export const withButtonStyle = (className?: string) =>
	className ? `${buttonStyle} ${className}` : buttonStyle;

/**
 * Every button in the app goes through here, so buttons can be styled in one
 * place. Takes the same props as <button>, plus an optional Feather icon
 * shown before the text; type defaults to "button" so a button only submits
 * a form when it says type="submit".
 */
export function Button({
	type = "button",
	className,
	icon,
	children,
	...props
}: ComponentProps<"button"> & { icon?: IconName }) {
	return (
		<button {...props} type={type} className={withButtonStyle(className)}>
			{icon && <ButtonIcon name={icon} />}
			{children}
		</button>
	);
}
