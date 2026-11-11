import { useState } from "react";
import type {
	CarryOverFlags,
	ProtocolItem,
	ProtocolValue,
} from "#/server/items";
import { MultilineText } from "../AgendaView";
import { AttendancePoint } from "./AttendancePoint";
import { DecisionPoint } from "./DecisionPoint";
import { MomentPoint } from "./MomentPoint";
import { NextMeetingPoint } from "./NextMeetingPoint";
import { PersonPoint } from "./PersonPoint";
import type { PointProps } from "./point";
import { TabledPoint } from "./TabledPoint";
import { TextPoint } from "./TextPoint";
import { TogglePoint } from "./TogglePoint";

/**
 * One point of a protocol during the meeting. Whether it is done is stored
 * with the point (value.done, set by "Klar"); "Ändra" opens a done point
 * again here until it is saved or cancelled.
 */
export function ProtocolPoint({
	item,
	invited,
	choosable,
	onSave,
	onCarryOver,
	onDelete,
}: {
	item: ProtocolItem;
	/** Everyone invited, for attendance. */
	invited: string[];
	/** Who can be picked in person choices. */
	choosable: string[];
	onSave: (value: ProtocolValue) => Promise<boolean>;
	onCarryOver: (flags: CarryOverFlags) => Promise<boolean>;
	onDelete: () => void;
}) {
	const [reopened, setReopened] = useState(false);

	const props: PointProps = {
		item,
		done: !!item.value.done && !reopened,
		reopened,
		save: async (value, finish = true) => {
			const ok = await onSave({ ...value, done: finish });
			if (ok && finish) setReopened(false);
			return ok;
		},
		edit: () => setReopened(true),
		cancel: () => setReopened(false),
		carryOver: onCarryOver,
		remove: onDelete,
	};

	return (
		<fieldset>
			<legend>{item.title}</legend>
			{item.description && <MultilineText text={item.description} />}
			{item.value.tabled ? (
				<TabledPoint {...props} />
			) : (
				<PointBody {...props} invited={invited} choosable={choosable} />
			)}
		</fieldset>
	);
}

function PointBody(
	props: PointProps & { invited: string[]; choosable: string[] },
) {
	switch (props.item.type) {
		case "open":
		case "close":
			return <MomentPoint {...props} />;
		case "toggle":
			return <TogglePoint {...props} />;
		case "attendance":
			return <AttendancePoint {...props} />;
		case "person":
			return <PersonPoint {...props} />;
		case "decision":
			return <DecisionPoint {...props} />;
		case "next_meeting":
			return <NextMeetingPoint {...props} />;
		case "text":
			return <TextPoint {...props} />;
	}
}
