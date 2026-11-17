import { Icon } from "./Icon";
import { Section } from "./Section";

/**
 * Download the closed protocol as PDF or Markdown. `base` is the download
 * address without the format, e.g. "/api/protokoll/<id>".
 */
export function DownloadSection({ base }: { base: string }) {
	return (
		<Section id="download" title="Ladda ner">
			<p>Protokollet som fil, med punkterna, historiken och justeringen.</p>
			<ul className="list-disc pl-6">
				<li>
					<a href={`${base}/pdf`} download>
						<Icon name="download" className="mr-2 size-[1.1em]" />
						Ladda ner som PDF
					</a>
				</li>
				<li>
					<a href={`${base}/md`} download>
						<Icon name="download" className="mr-2 size-[1.1em]" />
						Ladda ner som Markdown
					</a>
				</li>
			</ul>
		</Section>
	);
}
