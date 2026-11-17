import { MeetingDetails } from "#/components/MeetingDetails";
import { ProtocolPointList } from "#/components/points/lists/ProtocolPointList";
import type { RecordedItem } from "#/components/points/shared/point";
import { Section } from "#/components/Section";
import type { Justering, ProtocolEdit } from "#/server/items";
import { Instant } from "./DateTime";
import { Signature } from "./Signature";

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

/**
 * Who justerade the protocol, with their drawn signatures, as its own
 * section (public and justering pages). The members' protocol page shows
 * the same inside ReviewSection, with the justering's status.
 */
export function JusteringSection({
	justering,
}: {
	justering: Justering | null;
}) {
	if (!justering) return null;
	return (
		<Section id="justering" title="Justering">
			<JusteringSignatures justering={justering} />
		</Section>
	);
}

/**
 * Each justerare's signature and time, after "Protokollet är justerat av:"
 * (left out where a status line just above already says it is justerat).
 */
export function JusteringSignatures({
	justering,
	intro = true,
}: {
	justering: Justering;
	intro?: boolean;
}) {
	return (
		<>
			{intro && <p>Protokollet är justerat av:</p>}
			{/* No markers: each signature stands on its own. role="list" keeps
			    Safari announcing it as a list without them. */}
			{/* biome-ignore lint/a11y/noRedundantRoles: Safari drops the list role without markers */}
			{/* biome-ignore lint/a11y/useSemanticElements: it is a <ul>; Safari drops its list role without markers */}
			<ul role="list" className="space-y-4">
				{justering.reviewers.map((r) => (
					<li key={r.name}>
						<figure>
							{r.signature && <Signature stored={r.signature} name={r.name} />}
							<figcaption>
								{r.name}, {r.signature ? "signerat" : "godkänt"}{" "}
								<Instant at={r.approvedAt} />
							</figcaption>
						</figure>
					</li>
				))}
			</ul>
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
