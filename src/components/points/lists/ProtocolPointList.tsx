import { MultilineText } from "#/components/MultilineText";
import { RecordedValue } from "../RecordedValue";
import type { RecordedItem } from "../shared/point";

/**
 * The points of a finished protocol, read-only: in the app, on the public
 * page and for justering. What each point recorded is its type's Display.
 */
export function ProtocolPointList({ items }: { items: RecordedItem[] }) {
	if (items.length === 0) return <p>Inga punkter på dagordningen.</p>;
	return (
		<ol className="list-decimal py-5 pl-7 space-y-1.5 sm:p-5">
			{items.map((item) => (
				<li key={item.id} className="pl-2">
					<h3 className="font-bold text-xl py-2.5">{item.title}</h3>
					<div className="">
						{item.description && <MultilineText text={item.description} />}
						<RecordedValue item={item} />
					</div>
				</li>
			))}
		</ol>
	);
}
