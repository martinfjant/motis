import { Section } from "./Section";

/**
 * Download the closed protocol as PDF or Markdown. `base` is the download
 * address without the format, e.g. "/api/protokoll/<id>".
 */
export function DownloadSection({ base }: { base: string }) {
	return (
		<Section id="download" title="Ladda ner">
			<p>Protokollet som fil, med punkterna, historiken och justeringen.</p>
			<ul>
				<li>
					<a href={`${base}/pdf`} download>
						Ladda ner som PDF
					</a>
				</li>
				<li>
					<a href={`${base}/md`} download>
						Ladda ner som Markdown
					</a>
				</li>
			</ul>
		</Section>
	);
}
