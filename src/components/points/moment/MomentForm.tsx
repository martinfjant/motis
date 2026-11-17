import { useEffect, useState } from "react";
import { Button } from "#/components/Button";
import { MeetingTime } from "#/components/DateTime";
import { Field, Input } from "#/components/Field";
import { toLocalStamp } from "#/meeting-time";
import { NotesEditor } from "../shared/NotesEditor";
import { fieldId, type PointProps } from "../shared/point";
import { momentText } from "./momentText";

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
export function MomentForm({ item, done, save, edit, cancel }: PointProps) {
	const text = momentText(item.type);
	const v = item.value;
	const now = useNow();
	const inputId = fieldId(item, "at");

	return (
		<div className="space-y-5">
      {done && v.at ? (
        <>
				<p>
					{text.done} <MeetingTime at={v.at} />
				</p>
          <Button onClick={edit}>Ändra</Button>
        </>

			) : v.at ? (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						const at = String(new FormData(e.currentTarget).get("at") ?? "");
						save({ ...v, at });
            }}
            className="block space-y-5"
				>
					<Field id={inputId} label={text.done}>
						<Input
							name="at"
							type="datetime-local"
							defaultValue={v.at}
							required
						/>
					</Field>
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
		</div>
	);
}
