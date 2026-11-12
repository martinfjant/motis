import type { ComponentProps } from "react";

/**
 * How buttons look. Shared with LinkButton, so a link styled as a button
 * always looks the same as a real one: change it here for both.
 * inline-block is what a <button> already is; links need it to match.
 */
export const buttonStyle =
	"inline-block rounded-lg px-3 py-1 text-lg mr-3 bg-stone-300 hover:bg-sky-600 hover:text-white";

/** buttonStyle plus any classes given for one button or link. */
export const withButtonStyle = (className?: string) =>
	className ? `${buttonStyle} ${className}` : buttonStyle;

/**
 * Every button in the app goes through here, so buttons can be styled in one
 * place. Takes the same props as <button>; type defaults to "button" so a
 * button only submits a form when it says type="submit".
 */
export function Button({
	type = "button",
	className,
	...props
}: ComponentProps<"button">) {
	return (
		<button {...props} type={type} className={withButtonStyle(className)} />
	);
}
