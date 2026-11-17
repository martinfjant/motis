import type { RecordedItem } from "../shared/point";
import { ATTENDANCE_TEXT } from "./attendanceText";

/** Who was present, as a list. */
export function AttendanceDisplay({ item }: { item: RecordedItem }) {
	const present = item.value.present ?? [];
	if (present.length === 0) return <p>{ATTENDANCE_TEXT.none}</p>;
	return (
		<>
			<p>{ATTENDANCE_TEXT.present}</p>
			<ul>
				{present.map((name) => (
					<li key={name}>{name}</li>
				))}
			</ul>
		</>
	);
}
