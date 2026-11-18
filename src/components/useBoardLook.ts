import { useMatches } from "@tanstack/react-router";

type Look = {
	background?: unknown;
	logo?: unknown;
	banner?: unknown;
};

/**
 * How the board being viewed looks: its pattern, logo and banner, if any.
 * Board pages (and the public agenda, protocol and justering pages) return
 * the board in their loader data; the innermost one wins.
 */
export function useBoardLook(): {
	pattern?: string;
	logo?: string;
	banner?: string;
} {
	const boards = useMatches({
		select: (matches) =>
			matches.map(
				(m) =>
					(m.loaderData as { board?: Look } | null | undefined)?.board ??
					undefined,
			),
	});
	const board = [...boards].reverse().find((b) => b !== undefined);
	const text = (v: unknown) => (typeof v === "string" ? v : undefined);
	return {
		pattern: text(board?.background),
		logo: text(board?.logo),
		banner: text(board?.banner),
	};
}
