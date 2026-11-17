import { type ComponentType, useState } from "react";
import { MultilineText } from "#/components/MultilineText";
import {
	type CarryOverFlags,
	type ItemType,
	type PointState,
	type ProtocolItem,
	type ProtocolValue,
	pointState,
	type ReviewerCandidate,
} from "#/server/items";
import { AttendanceForm } from "./attendance/AttendanceForm";
import { DecisionForm } from "./decision/DecisionForm";
import { MomentForm } from "./moment/MomentForm";
import { NextMeetingForm } from "./next-meeting/NextMeetingForm";
import { PersonForm } from "./person/PersonForm";
import { ReviewersForm } from "./reviewers/ReviewersForm";
import type { PointProps } from "./shared/point";
import { pointStyle } from "./shared/pointStyle";
import { TabledPoint } from "./shared/TabledPoint";
import { TextForm } from "./text/TextForm";
import { ToggleForm } from "./toggle/ToggleForm";

/** What the meeting knows that some types' forms need. */
export type MeetingContext = {
	/** Everyone invited, for attendance. */
	invited: string[];
	/** Who can be picked in person choices. */
	choosable: string[];
	/** Who was marked present, for choosing justerare. */
	present: string[];
	/** Board members who can be justerare, if present. */
	reviewerCandidates: ReviewerCandidate[];
	/** Chosen as secretary, so not justerare. */
	secretaries: string[];
};

const FORMS: Record<ItemType, ComponentType<PointProps & MeetingContext>> = {
	open: MomentForm,
	close: MomentForm,
	toggle: ToggleForm,
	attendance: AttendanceForm,
	person: PersonForm,
	reviewers: ReviewersForm,
	decision: DecisionForm,
	next_meeting: NextMeetingForm,
	text: TextForm,
};

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
	secretaries,
	onSave,
	onCarryOver,
	onDelete,
}: MeetingContext & {
	item: ProtocolItem;
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

	const Form = FORMS[item.type];
	return (
		<fieldset className={`block space-y-2.5 ${pointStyle(state)}`}>
			<legend className="text-xl font-bold">{item.title}</legend>
			{item.description && <MultilineText text={item.description} />}
			{item.value.tabled ? (
				<TabledPoint {...props} />
			) : (
				<Form
					{...props}
					invited={invited}
					choosable={choosable}
					present={present}
					reviewerCandidates={reviewerCandidates}
					secretaries={secretaries}
				/>
			)}
		</fieldset>
	);
}
