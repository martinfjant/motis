import { MeetingDetails, MultilineText } from "#/components/AgendaView";
import { Section } from "#/components/Section";
import type { ProtocolEdit, ProtocolItem } from "#/server/items";
import { Instant, MeetingTime } from "./DateTime";

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
			<Section id="meeting" title="Mötet">
				<MeetingDetails
					meetingAt={protocol.meetingAt}
					location={protocol.location}
				/>
			</Section>
			<Section id="points" title="Punkter">
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
			</Section>
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
		<Section id="history" title="Historik">
			<ul>
				<li>
					Protokollet stängdes <Instant at={closedAt} />.
				</li>
				{edits.map((edit) => (
					<li key={edit.editedAt + edit.userName}>
						Redigerat <Instant at={edit.editedAt} /> av {edit.userName}.
					</li>
				))}
			</ul>
		</Section>
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
					{MOMENT_TEXT[item.type].done} <MeetingTime at={v.at} />
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
					Nästa möte: <MeetingTime at={v.at} />
				</p>
			)}
			{v.notes && <MultilineText text={v.notes} />}
			{v.followUp && <p>Kommer följas upp på nästa möte.</p>}
		</>
	);
}
