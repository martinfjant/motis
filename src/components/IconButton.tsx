import type { ComponentProps, ReactNode } from "react";

/**
 * A small button showing only an icon. The label is what screen readers
 * read and what shows as a tooltip, so make it say what happens, e.g.
 * "Ändra titel för Anna Andersson".
 */
export function IconButton({
	label,
	icon,
	type = "button",
	...props
}: Omit<ComponentProps<"button">, "children"> & {
	label: string;
	icon: ReactNode;
}) {
	return (
		<button
			type={type}
			aria-label={label}
			title={label}
			className="inline-flex size-7 items-center justify-center rounded-md align-middle text-stone-500 hover:bg-stone-200 hover:text-stone-900"
			{...props}
		>
			{icon}
		</button>
	);
}

/** A pen, for "change this". Decorative: the button carries the label. */
export function PenIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="size-4"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M12 20h9" />
			<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
		</svg>
	);
}

/** A tick, for "save". */
export function CheckIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="size-4"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M20 6 9 17l-5-5" />
		</svg>
	);
}

/** A cross, for "cancel". */
export function CloseIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="size-4"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M18 6 6 18M6 6l12 12" />
		</svg>
	);
}

/** A person, for the logged-in user. */
export function UserIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="size-5"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="8" r="4" />
			<path d="M4 21a8 8 0 0 1 16 0" />
		</svg>
	);
}

/** A closed padlock, for a protocol that is justerat and so final. */
export function LockIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="size-4"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="4" y="11" width="16" height="10" rx="2" />
			<path d="M8 11V7a4 4 0 0 1 8 0v4" />
		</svg>
	);
}
