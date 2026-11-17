import { Field, Select } from "#/components/Field";
import { DEFAULT_REVIEWER_COUNT } from "#/server/items";
import type { SettingsProps } from "../shared/point";

/** Whether the meeting chooses one justerare, or one or two. */
export function ReviewersSettings({ idPrefix, item }: SettingsProps) {
	return (
		<Field id={`${idPrefix}-reviewerCount`} label="Antal justerare">
			<Select
				name="reviewerCount"
				defaultValue={String(item?.reviewerCount ?? DEFAULT_REVIEWER_COUNT)}
			>
				<option value="1">En</option>
				<option value="2">En eller två</option>
			</Select>
		</Field>
	);
}
