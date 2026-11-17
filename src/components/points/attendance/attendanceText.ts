import type { TypeBlocks } from "../blocks";

/** Närvaro ("attendance"): how the recorded attendance reads. */
export const ATTENDANCE_TEXT = {
	present: "Närvarande:",
	none: "Ingen närvaro registrerad.",
};

export const attendanceBlocks: TypeBlocks = (v) => [
	v.present?.length
		? { kind: "list", label: ATTENDANCE_TEXT.present, items: v.present }
		: { kind: "text", text: ATTENDANCE_TEXT.none },
];
