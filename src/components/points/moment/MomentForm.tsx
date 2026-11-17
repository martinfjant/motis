import { useEffect, useState } from "react";
import { Button } from "#/components/Button";
import { MeetingTime } from "#/components/DateTime";
import { Field, Input } from "#/components/Field";
import { Form } from "#/components/Form";
import { useFocusMessage } from "#/components/useFocusMessage";
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
 * Opening or closing the meeting ("open"/"close"): a button with the current
 * time that records it, and "Annan tid…" to give another. When done it shows
 * the time with "Ändra" to correct it. Closing waits until every other point
 * is done or tabled: pressing it before that records nothing and shows (and
 * focuses) what is left. The server checks too.
 */
export function MomentForm({
	item,
	done,
	save,
	edit,
	cancel,
	unfinished = [],
}: PointProps & { unfinished?: string[] }) {
	const text = momentText(item.type);
	const v = item.value;
	const now = useNow();
	const [picking, setPicking] = useState(false);
	const blocked = useFocusMessage();
	const waiting = item.type === "close" && unfinished.length > 0;
	const inputId = fieldId(item, "at");
	const blockedId = fieldId(item, "blocked");

	/** Records the time, unless the meeting can't be closed yet. */
	function record(at: string) {
		if (waiting) {
			blocked.show();
			return;
		}
		save({ ...v, at });
	}

	return (
		<div className="space-y-5">
			{done && v.at ? (
				<>
					<p>
						{text.done} <MeetingTime at={v.at} />
					</p>
					<Button icon="edit-2" onClick={edit}>
						Ändra
					</Button>
				</>
			) : v.at ? (
				<Form
					onSubmit={(e) => {
						e.preventDefault();
						const at = String(new FormData(e.currentTarget).get("at") ?? "");
						save({ ...v, at });
					}}
				>
					<Field id={inputId} label={text.done}>
						<Input
							name="at"
							type="datetime-local"
							defaultValue={v.at}
							required
						/>
					</Field>
					<Button icon="check" type="submit">
						Klar
					</Button>{" "}
					<Button icon="x" onClick={cancel}>
						Avbryt
					</Button>
				</Form>
			) : picking ? (
				<Form
					onSubmit={(e) => {
						e.preventDefault();
						record(String(new FormData(e.currentTarget).get("at") ?? ""));
					}}
				>
					<Field id={inputId} label={text.done}>
						<Input
							name="at"
							type="datetime-local"
							defaultValue={toLocalStamp(new Date())}
							required
							autoFocus
						/>
					</Field>
					<Button icon="check" type="submit">
						Klar
					</Button>{" "}
					<Button
						icon="x"
						onClick={() => {
							setPicking(false);
							blocked.hide();
						}}
					>
						Avbryt
					</Button>
				</Form>
			) : (
				<p>
					<Button
						icon={text.icon}
						onClick={() => record(toLocalStamp(new Date()))}
					>
						{text.button}
						{now && (
							<>
								{" "}
								<time dateTime={toLocalStamp(now)}>
									{toLocalStamp(now).slice(11)}
								</time>
							</>
						)}
					</Button>
					<Button icon="clock" onClick={() => setPicking(true)}>
						Annan tid…
					</Button>
				</p>
			)}
			{!v.at && waiting && blocked.shown && (
				<p
					ref={blocked.ref}
					id={blockedId}
					tabIndex={-1}
					className="font-medium outline-none"
				>
					{unfinishedHint(unfinished)}
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

/** Why the meeting can't be closed yet, as shown under the button. */
export function unfinishedHint(titles: string[]) {
	return `Mötet kan avslutas när alla punkter är klara eller bordlagda. Kvar: ${titles.join(", ")}.`;
}
