import { type ReactNode, useId, useRef } from "react";
import { Button } from "./Button";
import type { IconName } from "./Icon";
import { IconButton } from "./IconButton";

/**
 * How dialogs look: a centred glass panel over a dimmed page (Tailwind's
 * base styles remove the browser's own centring and padding). Scrolls
 * inside if taller than the window; fades in unless motion is reduced.
 * Shared with ConfirmDialog.
 */
export const dialogStyle =
	"m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-glass-line bg-glass-strong p-6 text-ink shadow-2xl backdrop-blur-md backdrop:bg-black/40 backdrop:backdrop-blur-sm motion-safe:animate-appear";

/**
 * A button that opens a modal dialog with a heading. The content gets a
 * close() function. Closing the dialog, by close(), Escape or the
 * browser, resets its forms so it opens fresh next time.
 */
export function Dialog({
	title,
	openLabel,
	openIcon,
	onClose,
	children,
}: {
	title: ReactNode;
	/** Text of the button that opens it. */
	openLabel: ReactNode;
	/** Icon on that button. */
	openIcon?: IconName;
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
				<Button icon={openIcon} onClick={() => dialog.current?.showModal()}>
					{openLabel}
				</Button>
			</p>
			{/*
			 * Centred glass panel over a dimmed page (Tailwind's base styles
			 * remove the browser's own centring and padding). Scrolls inside if
			 * taller than the window; fades in unless motion is reduced.
			 */}
			<dialog
				ref={dialog}
				aria-labelledby={headingId}
				className={dialogStyle}
				onClose={(e) => {
					for (const form of e.currentTarget.querySelectorAll("form"))
						form.reset();
					onClose?.();
				}}
			>
				<div className="flex items-start justify-between gap-4">
					<h2 id={headingId} className="text-2xl">
						{title}
					</h2>
					<IconButton icon="x" label="Stäng" onClick={close} />
				</div>
				{children(close)}
			</dialog>
		</>
	);
}
