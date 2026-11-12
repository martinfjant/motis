import type { PointState } from "#/server/items";

/**
 * The classes for a point, by where it is at the meeting. Points get their
 * state as props.state, which counts a point opened with "Ändra" as open.
 */
export function pointStyle(state: PointState) {
	switch (state) {
		case "open":
			return "";
		case "done":
			return "text-red-500";
		case "tabled":
			return "";
	}
}
