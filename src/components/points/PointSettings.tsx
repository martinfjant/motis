import type { ComponentType } from "react";
import type { ItemType } from "#/server/items";
import { AttendanceSettings } from "./attendance/AttendanceSettings";
import { ReviewersSettings } from "./reviewers/ReviewersSettings";
import type { SettingsProps } from "./shared/point";
import { ToggleSettings } from "./toggle/ToggleSettings";

/** Types with settings of their own, besides title and description. */
const SETTINGS: Partial<Record<ItemType, ComponentType<SettingsProps>>> = {
	attendance: AttendanceSettings,
	reviewers: ReviewersSettings,
	toggle: ToggleSettings,
};

/**
 * The type's own fields when editing a point on a template or an agenda
 * (PointFields has the fields every point has). Nothing for most types.
 */
export function PointSettings({
	type,
	...props
}: SettingsProps & { type: ItemType }) {
	const Settings = SETTINGS[type];
	return Settings ? <Settings {...props} /> : null;
}
