import { createContext } from "react";
import type { ProtocolRef, RefLink } from "#/protocol-refs";

/**
 * The board's other protocols, for # in notes (MentionTextarea), and the
 * links of the references in the text, shown as links (MultilineText).
 * Only the members' protocol page provides them: elsewhere (public and
 * justering pages) references stay plain text, since a link would have to
 * use another protocol's share link and so give access to it.
 */
export const ProtocolRefs = createContext<{
	refs: ProtocolRef[];
	links?: RefLink[];
	boardId?: string;
}>({ refs: [] });
