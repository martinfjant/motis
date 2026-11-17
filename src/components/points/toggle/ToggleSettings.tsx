import { Field, Input } from "#/components/Field";
import type { SettingsProps } from "../shared/point";

/**
 * What the protocol says for each answer, e.g. "Dagordningen godkändes.".
 * Empty: just "Ja" or "Nej". The buttons at the meeting still say Ja/Nej.
 */
export function ToggleSettings({ idPrefix, item }: SettingsProps) {
	return (
		<>
			<Field
				id={`${idPrefix}-yesText`}
				label="I protokollet vid ja"
				hint="T.ex. ”Dagordningen godkändes.” Tomt: ”Ja”."
			>
				<Input name="yesText" defaultValue={item?.yesText} />
			</Field>
			<Field
				id={`${idPrefix}-noText`}
				label="I protokollet vid nej"
				hint="T.ex. ”Dagordningen godkändes inte.” Tomt: ”Nej”."
			>
				<Input name="noText" defaultValue={item?.noText} />
			</Field>
		</>
	);
}
