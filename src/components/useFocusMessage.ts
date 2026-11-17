import { useEffect, useRef, useState } from "react";

/**
 * A message shown when an action can't be done yet, instead of disabling the
 * button: show() makes it appear and moves focus to it (again on every
 * call), so screen readers read it at once. Give the element ref and
 * tabIndex={-1}.
 */
export function useFocusMessage<
	T extends HTMLElement = HTMLParagraphElement,
>() {
	const ref = useRef<T>(null);
	const [shown, setShown] = useState(0);
	useEffect(() => {
		if (shown > 0) ref.current?.focus();
	}, [shown]);
	return {
		ref,
		shown: shown > 0,
		show: () => setShown((n) => n + 1),
		hide: () => setShown(0),
	};
}
