import {
	type ComponentProps,
	createContext,
	type ReactNode,
	useContext,
	useId,
} from "react";

const FieldContext = createContext<{ id: string; hintId?: string } | null>(
	null,
);

/**
 * A labelled form field: the label, the control (Input, Textarea, Select or
 * MentionTextarea, passed as children) and an optional hint. The control
 * picks up its id (and the hint, for screen readers) from the field, so
 * they don't need to be repeated.
 */
export function Field({
	id: givenId,
	label,
	hint,
	children,
}: {
	/** Defaults to a generated id. */
	id?: string;
	label: ReactNode;
	/** Extra help shown with the field and read out with it. */
	hint?: ReactNode;
	children: ReactNode;
}) {
	const generatedId = useId();
	const id = givenId ?? generatedId;
	const hintId = hint ? `${id}-hint` : undefined;
	return (
		<FieldContext.Provider value={{ id, hintId }}>
			<p className="flex flex-col">
				<label htmlFor={id}>{label}</label>
				{children}
				{hint && <small id={hintId}>{hint}</small>}
			</p>
		</FieldContext.Provider>
	);
}

/** The id and aria-describedby a control gets from its Field, unless set. */
export function useFieldProps(props: {
	id?: string;
	"aria-describedby"?: string;
}) {
	const field = useContext(FieldContext);
	return {
		id: props.id ?? field?.id,
		"aria-describedby": props["aria-describedby"] ?? field?.hintId,
	};
}

export const fieldStyle =
	"w-full border-1 border-stone-400 rounded-lg text-lg w-full";
/** A text-like <input> (text, email, password, date…). */
export function Input(props: ComponentProps<"input">) {
	return <input {...props} className={fieldStyle} {...useFieldProps(props)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
	return (
		<textarea {...props} className={fieldStyle} {...useFieldProps(props)} />
	);
}

export function Select(props: ComponentProps<"select">) {
	return <select {...props} className={fieldStyle} {...useFieldProps(props)} />;
}
