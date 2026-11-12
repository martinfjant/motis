import { type ComponentProps, type ReactNode, useId } from "react";

type ChoiceProps = Omit<ComponentProps<"input">, "type"> & {
	label: ReactNode;
};

/** A checkbox with its label after it, on its own line. */
export function Checkbox({ label, id: givenId, ...props }: ChoiceProps) {
	const generatedId = useId();
	const id = givenId ?? generatedId;
	return (
		<p className="flex flex-row justify-normal">
			<input {...props} id={id} type="checkbox" />{" "}
			<label htmlFor={id}>{label}</label>
		</p>
	);
}

/** A radio button with its label after it. Put a group in one <p>. */
export function Radio({ label, id: givenId, ...props }: ChoiceProps) {
	const generatedId = useId();
	const id = givenId ?? generatedId;
	return (
		<span>
			<input {...props} id={id} type="radio" />{" "}
			<label htmlFor={id}>{label}</label>
		</span>
	);
}
