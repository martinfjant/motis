import { useState } from "react";
import {
	type CarryOverFlags,
	type PointState,
	type ProtocolItem,
	type ProtocolValue,
	pointState,
	type ReviewerCandidate,
} from "#/server/items";
import { MultilineText } from "../AgendaView";
import { AttendancePoint } from "./AttendancePoint";
import { DecisionPoint } from "./DecisionPoint";
import { MomentPoint } from "./MomentPoint";
import { NextMeetingPoint } from "./NextMeetingPoint";
import { PersonPoint } from "./PersonPoint";
import type { PointProps } from "./point";
import { pointStyle } from "./pointStyle";
import { ReviewersPoint } from "./ReviewersPoint";
import { TabledPoint } from "./TabledPoint";
import { TextPoint } from "./TextPoint";
import { TogglePoint } from "./TogglePoint";

/**
 * One point of a protocol during the meeting. Whether it is done is stored
 * with the point (value.done, set by "Klar"); "Ändra" opens a done point
 * again here until it is saved or cancelled, and while it is open the point
 * counts as "open", in its state and its style.
 */
export function ProtocolPoint({
	item,
	invited,
	choosable,
	present,
	reviewerCandidates,
	onSave,
	onCarryOver,
	onDelete,
}: {
	item: ProtocolItem;
	/** Everyone invited, for attendance. */
	invited: string[];
	/** Who can be picked in person choices. */
	choosable: string[];
	/** Who was marked present, for choosing justerare. */
	present: string[];
	/** Board members who can be justerare, if present. */
	reviewerCandidates: ReviewerCandidate[];
	onSave: (value: ProtocolValue) => Promise<boolean>;
	onCarryOver: (flags: CarryOverFlags) => Promise<boolean>;
	onDelete: () => void;
}) {
	const [reopened, setReopened] = useState(false);
	const state: PointState = reopened ? "open" : pointState(item.value);

	const props: PointProps = {
		item,
		state,
		done: state === "done",
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
		<fieldset className={`border-b border-stone-300 py-3 ${pointStyle(state)}`}>
			<legend className="text-lg font-bold">{item.title}</legend>
			{item.description && <MultilineText text={item.description} />}
			{item.value.tabled ? (
				<TabledPoint {...props} />
			) : (
				<PointBody
					{...props}
					invited={invited}
					choosable={choosable}
					present={present}
					reviewerCandidates={reviewerCandidates}
				/>
			)}
		</fieldset>
	);
}

function PointBody(
	props: PointProps & {
		invited: string[];
		choosable: string[];
		present: string[];
		reviewerCandidates: ReviewerCandidate[];
	},
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
		case "reviewers":
			return <ReviewersPoint {...props} />;
		case "decision":
			return <DecisionPoint {...props} />;
		case "next_meeting":
			return <NextMeetingPoint {...props} />;
		case "text":
			return <TextPoint {...props} />;
	}
}
