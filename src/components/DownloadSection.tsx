import { AnchorButton } from "./LinkButton";
import { Section } from "./Section";

/**
 * Download the closed protocol as PDF or Markdown. `base` is the download
 * address without the format, e.g. "/api/protokoll/<id>". With attachments,
 * the PDF has them appended and Markdown comes as a zip with the files;
 * both can also be had without them. Plain links with the button look: the
 * router must not try to open a download as a page.
 */
export function DownloadSection({
	base,
	attachments = 0,
}: {
	base: string;
	/** How many attachments the protocol has. */
	attachments?: number;
}) {
	return (
		<Section id="download" title="Ladda ner">
			<p>Protokollet som fil, med punkterna, historiken och justeringen.</p>
			{attachments > 0 && (
				<p>
					PDF:en får bilagorna efter protokollet; Markdown kommer som en zip-fil
					med bilagorna i en egen mapp. Med många eller stora bilagor kan du
					ladda ner protokollet utan dem.
				</p>
			)}
			<p>
				<AnchorButton href={`${base}/pdf`} download icon="file-pdf">
					{attachments > 0 ? "PDF med bilagor" : "Ladda ner som PDF"}
				</AnchorButton>
				<AnchorButton href={`${base}/md`} download icon="markdown">
					{attachments > 0
						? "Markdown med bilagor (zip)"
						: "Ladda ner som Markdown"}
				</AnchorButton>
			</p>
			{attachments > 0 && (
				<p>
					<AnchorButton
						href={`${base}/pdf?bilagor=nej`}
						download
						icon="file-pdf"
					>
						PDF utan bilagor
					</AnchorButton>
					<AnchorButton
						href={`${base}/md?bilagor=nej`}
						download
						icon="markdown"
					>
						Markdown utan bilagor
					</AnchorButton>
				</p>
			)}
		</Section>
	);
}
