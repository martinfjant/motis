import type { PointState } from "#/server/items";

/**
 * The classes for a point, by where it is at the meeting. Points get their
 * state as props.state, which counts a point opened with "Ändra" as open.
 * A done or tabled point steps back: muted text (and a small tick after its
 * title, see ProtocolPoint), so the points still to deal with stand out. A
 * tabled point is finished for this meeting too, just moved to the next.
 */
export function pointStyle(state: PointState) {
	switch (state) {
		case "open":
			return "";
		case "done":
		case "tabled":
			return "text-muted";
	}
}
