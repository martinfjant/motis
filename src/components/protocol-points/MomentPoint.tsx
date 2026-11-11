import { useEffect, useState } from "react";
import { formatMeetingAt, toLocalStamp } from "#/meeting-time";
import { Button } from "../Button";
import { MOMENT_TEXT } from "../ProtocolView";
import { NotesEditor } from "./NotesEditor";
import { fieldId, type PointProps } from "./point";

/** The current time, ticking. Null until mounted so server and client agree. */
function useNow() {
	const [now, setNow] = useState<Date | null>(null);
	useEffect(() => {
		const tick = () => setNow(new Date());
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	}, []);
	return now;
}

/**
 * Opening or closing the meeting ("open"/"close"): one button that records
 * the current time. When done it shows the time with "Ändra" to correct it.
 */
export function MomentPoint({ item, done, save, edit, cancel }: PointProps) {
	const text = MOMENT_TEXT[item.type === "close" ? "close" : "open"];
	const v = item.value;
	const now = useNow();
	const inputId = fieldId(item, "at");

	return (
		<>
			{done && v.at ? (
				<p>
					{text.done} <time dateTime={v.at}>{formatMeetingAt(v.at)}</time>{" "}
					<Button onClick={edit}>Ändra</Button>
				</p>
			) : v.at ? (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						const at = String(new FormData(e.currentTarget).get("at") ?? "");
						save({ ...v, at });
					}}
				>
					<p>
						<label htmlFor={inputId}>{text.done}</label>
						<input
							id={inputId}
							name="at"
							type="datetime-local"
							defaultValue={v.at}
							required
						/>
					</p>
					<Button type="submit">Klar</Button>{" "}
					<Button onClick={cancel}>Avbryt</Button>
				</form>
			) : (
				<p>
					{now && (
						<>
							Klockan är{" "}
							<time dateTime={toLocalStamp(now)}>
								{toLocalStamp(now).slice(11)}
							</time>{" "}
						</>
					)}
					<Button onClick={() => save({ ...v, at: toLocalStamp(new Date()) })}>
						{text.button}
					</Button>
				</p>
			)}
			{v.at && (
				<NotesEditor
					idPrefix={item.id}
					notes={v.notes}
					onSave={(notes) => save({ ...v, notes })}
				/>
			)}
		</>
	);
}
