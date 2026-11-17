import {
	type CarryOverFlags,
	type ProtocolItem,
	type ProtocolValue,
	secretaryNames,
} from "#/server/items";
import { type MeetingContext, ProtocolPoint } from "../ProtocolPoint";

/**
 * The points of a protocol during the meeting (and while editing a closed
 * one), each as its type's Form.
 */
export function MeetingPointList({
	items,
	onSave,
	onCarryOver,
	onDelete,
	...context
}: Omit<MeetingContext, "secretaries"> & {
	items: ProtocolItem[];
	onSave: (itemId: string) => (value: ProtocolValue) => Promise<boolean>;
	onCarryOver: (itemId: string) => (flags: CarryOverFlags) => Promise<boolean>;
	onDelete: (item: ProtocolItem) => void;
}) {
	if (items.length === 0) return <p>Inga punkter ännu.</p>;
	const secretaries = secretaryNames(items);
	return (
		<ol className="list-decimal p-5 space-y-10">
			{items.map((item) => (
				<li key={item.id}>
					<ProtocolPoint
						{...context}
						item={item}
						secretaries={secretaries}
						onSave={onSave(item.id)}
						onCarryOver={onCarryOver(item.id)}
						onDelete={() => onDelete(item)}
					/>
				</li>
			))}
		</ol>
	);
}
