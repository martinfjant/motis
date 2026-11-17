import { Field, Textarea } from "#/components/Field";
import type { SettingsProps } from "../shared/point";

/** Guests who are not board members, offered in attendance besides them. */
export function AttendanceSettings({ idPrefix, item }: SettingsProps) {
	return (
		<Field
			id={`${idPrefix}-extraNames`}
			label="Övriga deltagare som inte är ledamöter (ett namn per rad)"
		>
			<Textarea name="extraNames" defaultValue={item?.extraNames.join("\n")} />
		</Field>
	);
}
