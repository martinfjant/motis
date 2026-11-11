import { MeetingDetails, MultilineText } from "#/components/AgendaView";
import { formatInstant, formatMeetingAt } from "#/meeting-time";
import type { ProtocolEdit, ProtocolItem } from "#/server/items";

// Read-only protocol, shared by the closed protocol in the app and the public
// protocol page, so both always show the same thing.

/** The parts of a protocol point needed to show what was recorded. */
export type RecordedItem = Pick<
	ProtocolItem,
	"id" | "title" | "description" | "type" | "value"
>;

export const MOMENT_TEXT = {
	open: { button: "Öppna mötet", done: "Mötet öppnades" },
	close: { button: "Avsluta mötet", done: "Mötet avslutades" },
};

/** A closed protocol, read-only. */
export function ProtocolDisplay({
	protocol,
	items,
	edits,
}: {
	protocol: { meetingAt: string; location: string; closedAt: string | null };
	items: RecordedItem[];
	edits: ProtocolEdit[];
}) {
	return (
		<>
			<section aria-labelledby="meeting">
				<h2 id="meeting">Mötet</h2>
				<MeetingDetails
					meetingAt={protocol.meetingAt}
					location={protocol.location}
				/>
			</section>
			<section aria-labelledby="points">
				<h2 id="points">Punkter</h2>
				{items.length === 0 ? (
					<p>Inga punkter.</p>
				) : (
					<ol>
						{items.map((item) => (
							<li key={item.id}>
								<h3>{item.title}</h3>
								{item.description && <MultilineText text={item.description} />}
								<RecordedValue item={item} />
							</li>
						))}
					</ol>
				)}
			</section>
			<ProtocolHistory closedAt={protocol.closedAt} edits={edits} />
		</>
	);
}

/** When the protocol was closed, and every editing session after that. */
export function ProtocolHistory({
	closedAt,
	edits,
}: {
	closedAt: string | null;
	edits: ProtocolEdit[];
}) {
	if (!closedAt) return null;
	return (
		<section aria-labelledby="history">
			<h2 id="history">Historik</h2>
			<ul>
				<li>
					Protokollet stängdes{" "}
					<time dateTime={closedAt}>{formatInstant(closedAt)}</time>.
				</li>
				{edits.map((edit) => (
					<li key={edit.editedAt + edit.userName}>
						Redigerat{" "}
						<time dateTime={edit.editedAt}>{formatInstant(edit.editedAt)}</time>{" "}
						av {edit.userName}.
					</li>
				))}
			</ul>
		</section>
	);
}

/** What was recorded for one point, as text. */
export function RecordedValue({ item }: { item: RecordedItem }) {
	const v = item.value;
	return (
		<>
			{v.tabled && (
				<p>
					<strong>Bordlagd</strong> till nästa möte.
				</p>
			)}
			{(item.type === "open" || item.type === "close") && v.at && (
				<p>
					{MOMENT_TEXT[item.type].done}{" "}
					<time dateTime={v.at}>{formatMeetingAt(v.at)}</time>
				</p>
			)}
			{item.type === "toggle" && v.done !== undefined && (
				<p>{v.done ? "Ja" : "Nej"}</p>
			)}
			{item.type === "attendance" &&
				((v.present ?? []).length === 0 ? (
					<p>Ingen närvaro registrerad.</p>
				) : (
					<>
						<p>Närvarande:</p>
						<ul>
							{(v.present ?? []).map((name) => (
								<li key={name}>{name}</li>
							))}
						</ul>
					</>
				))}
			{item.type === "person" && v.person && (
				<p>
					Vald: <strong>{v.person}</strong>
				</p>
			)}
			{item.type === "decision" && v.decision && (
				<>
					<p>Beslut:</p>
					<blockquote>
						<MultilineText text={v.decision} />
					</blockquote>
				</>
			)}
			{item.type === "next_meeting" && v.at && (
				<p>
					Nästa möte: <time dateTime={v.at}>{formatMeetingAt(v.at)}</time>
				</p>
			)}
			{v.notes && <MultilineText text={v.notes} />}
			{v.followUp && <p>Kommer följas upp på nästa möte.</p>}
		</>
	);
}
