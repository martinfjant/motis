import { type ComponentProps, type ReactNode, useId } from "react";

type ChoiceProps = Omit<ComponentProps<"input">, "type"> & {
	label: ReactNode;
};

/** A checkbox with its label after it, on its own line. */
export function Checkbox({ label, id: givenId, ...props }: ChoiceProps) {
	const generatedId = useId();
	const id = givenId ?? generatedId;
	return (
		<p className="flex flex-row justify-normal gap-2.5">
			<input {...props} id={id} type="checkbox" className="m-1" />{" "}
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
			<input {...props} id={id} type="radio" className="hidden peer" />{" "}
			<label
				htmlFor={id}
				className="flex flex-col p-3 rounded-lg border-2 border-stone-300 hover:font-bold transition-all cursor-pointer text-xl text-center peer-checked:bg-teal-700 peer-checked:border-teal-600 peer-checked:text-white"
			>
				{label}
			</label>
		</span>
	);
}
