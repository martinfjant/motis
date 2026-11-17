import { formatMeetingAt } from "#/meeting-time";
import type { ItemType } from "#/server/items";
import type { TypeBlocks } from "../blocks";

/** Opening and closing the meeting ("open"/"close"): the button and the record. */
export const MOMENT_TEXT = {
	open: { button: "Öppna mötet", done: "Mötet öppnades" },
	close: { button: "Avsluta mötet", done: "Mötet avslutades" },
};

export const momentText = (type: ItemType) =>
	MOMENT_TEXT[type === "close" ? "close" : "open"];

export const momentBlocks: TypeBlocks = (v, type) =>
	v.at
		? [
				{
					kind: "text",
					text: `${momentText(type).done} ${formatMeetingAt(v.at)}`,
				},
			]
		: [];
