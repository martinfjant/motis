import type { ComponentProps } from "react";

/**
 * Every button in the app goes through here, so buttons can be styled in one
 * place. Takes the same props as <button>; type defaults to "button" so a
 * button only submits a form when it says type="submit".
 */
export function Button({
	type = "button",
	...props
}: ComponentProps<"button">) {
	return <button type={type} {...props} />;
}
