import { createContext } from "react";
import type { ProtocolRef } from "#/protocol-refs";

/**
 * The board's other protocols, for # in notes (MentionTextarea) and, with
 * boardId, for linking such references when text is shown (MultilineText).
 * Only the members' protocol page provides boardId: elsewhere (public and
 * justering pages) references stay plain text, since a link would have to
 * use another protocol's share link and so give access to it.
 */
export const ProtocolRefs = createContext<{
	refs: ProtocolRef[];
	boardId?: string;
}>({ refs: [] });
