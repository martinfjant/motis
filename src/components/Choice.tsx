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
 * A radio button shown as a box with a round marker and its label, left
 * aligned (labels can be whole sentences). The real radio is only hidden
 * visually, so it can still be reached and chosen with the keyboard (Tab,
 * then the arrow keys). Chosen: filled teal, with a tick in the marker.
 * Put a group in one element.
 */
export function Radio({ label, id: givenId, ...props }: ChoiceProps) {
	const generatedId = useId();
	const id = givenId ?? generatedId;
	return (
		<span className="flex">
			<input {...props} id={id} type="radio" className="peer sr-only" />
			<label
				htmlFor={id}
				className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-field px-4 py-3 text-left text-lg shadow-2xs transition-colors hover:border-accent peer-checked:border-accent-strong peer-checked:bg-accent-strong peer-checked:text-on-accent peer-focus-visible:ring-3 peer-focus-visible:ring-accent/30 peer-checked:[&_svg]:opacity-100"
			>
				<span
					aria-hidden="true"
					className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-current"
				>
					<Icon name="check" className="size-3.5 opacity-0" />
				</span>
				{label}
			</label>
		</span>
	);
}
