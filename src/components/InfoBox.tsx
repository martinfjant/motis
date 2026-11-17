import type { ComponentProps } from "react";

/**
 * Something the user should know about the page, outside its sections:
 * "Bekräfta din e-postadress", "Du redigerar ett stängt protokoll"…
 * Give it an aria-label saying what it is about.
 */
export function InfoBox(props: ComponentProps<"aside">) {
	return (
		<aside
			{...props}
			className="space-y-2.5 rounded-2xl border border-info-line bg-info p-4 text-on-info shadow-2xs"
		/>
	);
}
