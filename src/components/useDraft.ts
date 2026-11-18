import { type RefObject, useEffect, useState } from "react";

/** Drafts older than this are left alone (and removed). */
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

type Draft = { text: string; at: number };

const keyFor = (id: string) => `motis:utkast:${location.pathname}:${id}`;

function read(key: string): Draft | null {
	try {
		const draft = JSON.parse(localStorage.getItem(key) ?? "null");
		if (typeof draft?.text !== "string" || typeof draft.at !== "number")
			return null;
		return draft;
	} catch {
		return null;
	}
}

function write(key: string, draft: Draft | null) {
	try {
		if (draft) localStorage.setItem(key, JSON.stringify(draft));
		else localStorage.removeItem(key);
	} catch {
		// Private browsing or full storage: no drafts, nothing else breaks.
	}
}

/**
 * Keeps what is typed in a text area on this device until the server has
 * it, so notes survive a lost connection, a reload or a closed tab.
 *
 * Each keystroke stores the text (per page and field). When the field
 * opens with a saved text that differs from the draft, the draft is put
 * back and `restored` says when it was written; `discard` goes back to the
 * saved text. A draft equal to the saved text is done with and removed.
 */
export function useDraft(
	textarea: RefObject<HTMLTextAreaElement | null>,
	id: string | undefined,
	saved = "",
) {
	const [restored, setRestored] = useState<Date | null>(null);

	useEffect(() => {
		const el = textarea.current;
		if (!el || !id) return;
		const key = keyFor(id);
		const draft = read(key);
		if (!draft || draft.text === saved || Date.now() - draft.at > MAX_AGE) {
			write(key, null);
			return;
		}
		el.value = draft.text;
		setRestored(new Date(draft.at));
	}, [textarea, id, saved]);

	return {
		restored,
		/** Call on input: stores the text, or clears it if it is the saved one. */
		save() {
			const el = textarea.current;
			if (!el || !id) return;
			write(
				keyFor(id),
				el.value === saved ? null : { text: el.value, at: Date.now() },
			);
		},
		/** Throws the draft away and shows the saved text again. */
		discard() {
			const el = textarea.current;
			if (!el || !id) return;
			el.value = saved;
			write(keyFor(id), null);
			setRestored(null);
			el.focus();
		},
	};
}
