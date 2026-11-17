import { MeetingDetails } from "#/components/MeetingDetails";
import { ProtocolPointList } from "#/components/points/lists/ProtocolPointList";
import type { RecordedItem } from "#/components/points/shared/point";
import { Section } from "#/components/Section";
import type { Justering, ProtocolEdit } from "#/server/items";
import { Instant } from "./DateTime";

// Read-only protocol, shared by the closed protocol in the app and the public
// protocol page, so both always show the same thing.

/** A closed protocol, read-only, with its justering once justerat. */
export function ProtocolDisplay({
	protocol,
	items,
	edits,
	justering = null,
}: {
	protocol: { meetingAt: string; location: string; closedAt: string | null };
	items: RecordedItem[];
	edits: ProtocolEdit[];
	justering?: Justering | null;
}) {
	return (
		<>
			<Section id="meeting" title="Mötet">
				<MeetingDetails
					meetingAt={protocol.meetingAt}
					location={protocol.location}
				/>
			</Section>
			<Section id="points" title="Dagordning">
				<ProtocolPointList items={items} />
			</Section>
			<ProtocolHistory closedAt={protocol.closedAt} edits={edits} />
			<JusteringSection justering={justering} />
		</>
	);
}

/** Who justerade the protocol, with their drawn signatures. */
export function JusteringSection({
	justering,
}: {
	justering: Justering | null;
}) {
	if (!justering) return null;
	return (
		<Section id="justering" title="Justering">
			<p>Protokollet är justerat av:</p>
			<ul className="list-disc pl-6">
				{justering.reviewers.map((r) => (
					<li key={r.name}>
						<figure>
							{r.signature && (
								<img
									src={r.signature}
									alt={`Signatur: ${r.name}`}
									className="h-16 w-auto rounded bg-white"
								/>
							)}
							<figcaption>
								{r.name}, {r.signature ? "signerat" : "godkänt"}{" "}
								<Instant at={r.approvedAt} />
							</figcaption>
						</figure>
					</li>
				))}
			</ul>
		</Section>
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
			<ul className="list-disc pl-6">
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
