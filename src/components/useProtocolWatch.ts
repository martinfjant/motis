import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { leaveProtocol, watchProtocol } from "#/server/protocols.functions";

/** How often a page with an ongoing meeting checks for changes (ms). */
const INTERVAL = 2000;

type Editor = { name: string; me: boolean } | null;

/**
 * Keeps a page showing an ongoing meeting up to date, and decides who
 * writes the protocol: one tab at a time (see watchProtocol on the server).
 * Every couple of seconds it asks the server; when the protocol has changed
 * and this tab is only watching, the page reloads its data.
 *
 * The tab's id lives in sessionStorage, so a reload keeps it writing.
 * `initial` is who the page was loaded with, until the first answer.
 */
export function useProtocolWatch({
	protocolId,
	open,
	version,
	initial,
}: {
	protocolId: string;
	/** Only ongoing meetings are watched. */
	open: boolean;
	/** The version the page shows now. */
	version: string;
	initial: Editor;
}) {
	const router = useRouter();
	const [session, setSession] = useState<string | null>(null);
	const [editor, setEditor] = useState<Editor>(initial);
	// Who took over from this tab, to say so.
	const [lostTo, setLostTo] = useState<string | null>(null);
	const shown = useRef(version);
	shown.current = version;
	// Confirmed by the server, not just guessed from `initial`.
	const wasMe = useRef(false);
	// Ask now (e.g. after taking over) instead of waiting for the next turn.
	const askNow = useRef<(takeOver?: boolean) => Promise<void>>(async () => {});

	useEffect(() => setSession(tabSession(protocolId)), [protocolId]);

	useEffect(() => {
		if (!open || !session) return;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		async function ask(takeOver = false) {
			clearTimeout(timer);
			try {
				const answer = await watchProtocol({
					data: { protocolId, session, takeOver },
				});
				if (stopped || !session) return;
				const me = answer.editor?.me ?? false;
				if (wasMe.current && !me) setLostTo(answer.editor?.name ?? null);
				if (me) setLostTo(null);
				// Writing it: what's shown is what this tab saved. Watching (or
				// just taken over): catch up with what the other tab saved.
				if (answer.version !== shown.current && (!me || !wasMe.current))
					await router.invalidate();
				wasMe.current = me;
				setEditor(answer.editor);
			} catch {
				// Offline for a moment, or logged out: try again next turn.
			}
			if (!stopped) timer = setTimeout(() => ask(), INTERVAL);
		}
		askNow.current = ask;

		// Back to a tab that was in the background: check at once.
		const onVisible = () => {
			if (document.visibilityState === "visible") ask();
		};
		document.addEventListener("visibilitychange", onVisible);
		ask();
		return () => {
			stopped = true;
			clearTimeout(timer);
			document.removeEventListener("visibilitychange", onVisible);
			// Leaving the page within the app: let someone else write it. (Not
			// on reload, when the tab comes straight back.)
			if (wasMe.current)
				leaveProtocol({ data: { protocolId, session } }).catch(() => {});
		};
	}, [open, session, protocolId, router]);

	return {
		/** Sent with every change, so the server knows it is from the writer. */
		session: session ?? undefined,
		/** Who writes the protocol (null: nobody yet). */
		editor,
		/** Whether this tab may change it. */
		writing: !open || editor === null || editor.me,
		/** Set when someone else took over from this tab. */
		lostTo,
		takeOver: () => askNow.current(true),
	};
}

/** This tab's id for the protocol, kept across reloads where possible. */
function tabSession(protocolId: string) {
	const key = `motis:flik:${protocolId}`;
	try {
		const stored = sessionStorage.getItem(key);
		if (stored) return stored;
		const made = crypto.randomUUID();
		sessionStorage.setItem(key, made);
		return made;
	} catch {
		return crypto.randomUUID();
	}
}
