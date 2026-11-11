import { type ReactNode, useId, useRef } from "react";
import { Button } from "./Button";

/**
 * A button that opens a modal dialog with a heading. The content gets a
 * close() function. Closing the dialog, by close(), Escape or the
 * browser, resets its forms so it opens fresh next time.
 */
export function Dialog({
	title,
	openLabel,
	onClose,
	children,
}: {
	title: ReactNode;
	/** Text of the button that opens it. */
	openLabel: ReactNode;
	/** After closing, e.g. to clear an error message. */
	onClose?: () => void;
	children: (close: () => void) => ReactNode;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const headingId = useId();
	const close = () => dialog.current?.close();
	return (
		<>
			<p>
				<Button onClick={() => dialog.current?.showModal()}>{openLabel}</Button>
			</p>
			<dialog
				ref={dialog}
				aria-labelledby={headingId}
				onClose={(e) => {
					for (const form of e.currentTarget.querySelectorAll("form"))
						form.reset();
					onClose?.();
				}}
			>
				<h2 id={headingId}>{title}</h2>
				{children(close)}
			</dialog>
		</>
	);
}
