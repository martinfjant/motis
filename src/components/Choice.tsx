import { type ComponentProps, type ReactNode, useId } from "react";
import { Icon } from "./Icon";

type ChoiceProps = Omit<ComponentProps<"input">, "type"> & {
	label: ReactNode;
};

/**
 * A checkbox with its label after it, on its own line. Drawn by us (the
 * browser's is tiny): a box like the other fields, filled teal with a tick
 * when checked. The border uses the muted text colour so the empty box has
 * enough contrast (3:1 for controls).
 */
export function Checkbox({ label, id: givenId, ...props }: ChoiceProps) {
	const generatedId = useId();
	const id = givenId ?? generatedId;
	return (
		<p className="flex items-center gap-3">
			<span className="relative inline-flex shrink-0">
				<input
					{...props}
					id={id}
					type="checkbox"
					className="peer size-6 cursor-pointer appearance-none rounded-md border-2 border-muted bg-field outline-none transition-colors hover:border-accent checked:border-accent-strong checked:bg-accent-strong focus-visible:ring-3 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<Icon
					name="check"
					className="pointer-events-none absolute inset-0 m-auto size-4 text-on-accent opacity-0 peer-checked:opacity-100"
				/>
			</span>
			<label htmlFor={id} className="cursor-pointer">
				{label}
			</label>
		</p>
	);
}

/**
 * A radio button shown as a box with its label. The real radio is only
 * hidden visually, so it can still be reached and chosen with the keyboard.
 * Put a group in one <p>.
 */
export function Radio({ label, id: givenId, ...props }: ChoiceProps) {
	const generatedId = useId();
	const id = givenId ?? generatedId;
	return (
		<span>
			<input {...props} id={id} type="radio" className="peer sr-only" />{" "}
			<label
				htmlFor={id}
				className="flex flex-col p-3 rounded-lg border-2 border-line hover:font-bold transition-all cursor-pointer text-xl text-center peer-checked:bg-accent-strong peer-checked:border-accent peer-checked:text-on-accent peer-focus-visible:ring-3 peer-focus-visible:ring-accent/30"
			>
				{label}
			</label>
		</span>
	);
}
