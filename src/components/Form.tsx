import type { ComponentProps } from "react";

/** A form with its fields and buttons stacked. */
export function Form(props: ComponentProps<"form">) {
	return <form {...props} className="block space-y-5" />;
}
