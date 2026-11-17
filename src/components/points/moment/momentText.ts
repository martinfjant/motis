import type { IconName } from "#/components/Icon";
import { formatMeetingAt } from "#/meeting-time";
import type { ItemType } from "#/server/items";
import type { TypeBlocks } from "../blocks";

/** Opening and closing the meeting ("open"/"close"): the button and the record. */
export const MOMENT_TEXT = {
	open: { button: "Öppna mötet", icon: "play", done: "Mötet öppnades" },
	close: { button: "Avsluta mötet", icon: "square", done: "Mötet avslutades" },
} as const satisfies Record<
	string,
	{ button: string; icon: IconName; done: string }
>;

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
