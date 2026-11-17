import { MultilineText } from "#/components/MultilineText";

/**
 * The agenda's points as a numbered list, read-only: on the agenda page and
 * the public agenda. Every type looks the same here: title and description.
 */
export function AgendaPointList({
	items,
	headingLevel,
}: {
	items: { id: string; title: string; description: string }[];
	headingLevel: 2 | 3;
}) {
	const Heading = headingLevel === 2 ? "h2" : "h3";
	if (items.length === 0) return <p>Dagordningen har inga punkter ännu.</p>;
	return (
		<ol className="list-decimal p-5 space-y-1.5">
			{items.map((item) => (
				<li key={item.id} className="pl-2">
					<Heading className="font-bold text-xl py-2.5">{item.title}</Heading>
					<MultilineText text={item.description} />
				</li>
			))}
		</ol>
	);
}
