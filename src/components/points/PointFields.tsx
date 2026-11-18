import { useState } from "react";
import { Field, Input, Select } from "#/components/Field";
import { MentionTextarea } from "#/components/MentionTextarea";
import {
	ITEM_TYPE_LABELS,
	ITEM_TYPES,
	type Item,
	type ItemType,
} from "#/server/items";
import { PointSettings } from "./PointSettings";

/**
 * One point's fields when editing a template or an agenda, or adding a point
 * to a protocol: title, type and description, then the type's own settings.
 */
export function PointFields({
	idPrefix,
	item,
}: {
	idPrefix: string;
	item?: Item;
}) {
	const [type, setType] = useState<ItemType>(item?.type ?? "text");
	const id = (name: string) => `${idPrefix}-${name}`;
	return (
		<>
			<Field id={id("title")} label="Rubrik">
				<Input name="title" defaultValue={item?.title} required />
			</Field>
			<Field id={id("type")} label="Typ">
				<Select
					name="type"
					value={type}
					onChange={(e) => setType(e.target.value as ItemType)}
				>
					{ITEM_TYPES.map((t) => (
						<option key={t} value={t}>
							{ITEM_TYPE_LABELS[t]}
						</option>
					))}
				</Select>
			</Field>
			<Field id={id("description")} label="Beskrivning">
				{/* # refers to the meeting's attachments ("Bilaga 1"), where it has any. */}
				<MentionTextarea
					name="description"
					defaultValue={item?.description}
					drafts={false}
				/>
			</Field>
			<PointSettings type={type} idPrefix={idPrefix} item={item} />
		</>
	);
}
