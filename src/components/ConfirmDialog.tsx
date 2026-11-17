import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { Button } from "./Button";
import { dialogStyle } from "./Dialog";
import type { IconName } from "./Icon";

export type ConfirmOptions = {
	/** The question, e.g. "Ta bort punkten ”Ekonomi”?" */
	title: string;
	/** More about what happens, if needed. */
	message?: ReactNode;
	/** What the confirming button says, e.g. "Ta bort". Default "Ja". */
	confirmLabel?: string;
	confirmIcon?: IconName;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Asks the user to confirm, in the app's own dialog instead of the
 * browser's confirm(): `if (await confirm({ title, confirmLabel })) …`.
 * Resolves true for the confirming button, false for "Avbryt" or Escape.
 */
export function useConfirm(): Confirm {
	const confirm = useContext(ConfirmContext);
	if (!confirm) throw new Error("useConfirm needs a ConfirmProvider.");
	return confirm;
}

/**
 * Holds the one confirm dialog for the whole app (in the root layout). It
 * is an alertdialog, so screen readers read the question; focus starts on
 * "Avbryt" so Enter can't confirm by mistake, and goes back to where it was
 * when the dialog closes.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
	const dialog = useRef<HTMLDialogElement>(null);
	const answer = useRef<((ok: boolean) => void) | null>(null);
	const cancelButton = useRef<HTMLButtonElement>(null);
	/** Where focus was when asked, to go back to afterwards. */
	const returnFocus = useRef<HTMLElement | null>(null);
	const [options, setOptions] = useState<ConfirmOptions | null>(null);
	const titleId = useId();
	const messageId = useId();

	const confirm = useCallback<Confirm>((next) => {
		// A question still open is answered "no" before asking the next.
		answer.current?.(false);
		setOptions(next);
		return new Promise((resolve) => {
			answer.current = resolve;
		});
	}, []);

	useEffect(() => {
		if (!options || dialog.current?.open) return;
		returnFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		dialog.current?.showModal();
		// Start on the safe choice (showModal would pick the first button).
		cancelButton.current?.focus();
	}, [options]);

	function finish(ok: boolean) {
		answer.current?.(ok);
		answer.current = null;
		dialog.current?.close();
	}

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			<dialog
				ref={dialog}
				role="alertdialog"
				aria-labelledby={titleId}
				aria-describedby={options?.message ? messageId : undefined}
				className={dialogStyle}
				onClose={() => {
					// Escape, or closed some other way: that's a no.
					answer.current?.(false);
					answer.current = null;
					setOptions(null);
					returnFocus.current?.focus();
					returnFocus.current = null;
				}}
			>
				{options && (
					<>
						<h2 id={titleId} className="text-2xl">
							{options.title}
						</h2>
						{options.message && <div id={messageId}>{options.message}</div>}
						<p>
							<Button
								icon={options.confirmIcon ?? "check"}
								onClick={() => finish(true)}
							>
								{options.confirmLabel ?? "Ja"}
							</Button>
							{/* Where focus starts: the safe choice. */}
							<Button ref={cancelButton} icon="x" onClick={() => finish(false)}>
								Avbryt
							</Button>
						</p>
					</>
				)}
			</dialog>
		</ConfirmContext.Provider>
	);
}
