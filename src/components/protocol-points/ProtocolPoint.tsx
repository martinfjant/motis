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
import { hasValue, type PointProps } from "./point";
import { TabledPoint } from "./TabledPoint";
import { TextPoint } from "./TextPoint";
import { TogglePoint } from "./TogglePoint";

/**
 * Where a point is in being dealt with:
 * - "auto": klar once something is recorded (how a point starts).
 * - "open": saved but kept open (attendance after a tick).
 * - "reopened": klar, then opened with "Ändra".
 * - "closed": klar, also when nothing was written ("Klar" on empty notes).
 */
type Mode = "auto" | "open" | "reopened" | "closed";

/**
 * One point of a protocol during the meeting. Keeps track of whether it is
 * klar and hands that to the component for its kind of point.
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
	const [mode, setMode] = useState<Mode>("auto");

	const props: PointProps = {
		item,
		klar: mode === "closed" || (mode === "auto" && hasValue(item.value)),
		reopened: mode === "reopened",
		save: async (value, done = true) => {
			const ok = await onSave(value);
			if (ok) setMode((m) => (done ? "closed" : m === "auto" ? "open" : m));
			return ok;
		},
		edit: () => setMode("reopened"),
		cancel: () => setMode("closed"),
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
