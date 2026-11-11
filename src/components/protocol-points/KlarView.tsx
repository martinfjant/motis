import { RecordedValue } from "../ProtocolView";
import { PointActions } from "./PointActions";
import { hasValue, type PointProps } from "./point";

/** A klar point: what was recorded, as text, and "Ändra". */
export function KlarView(props: PointProps) {
	return (
		<>
			<RecordedValue item={props.item} />
			<PointActions
				{...props}
				submit={false}
				editLabel={
					hasValue(props.item.value) ? "Ändra" : "Lägg till anteckning"
				}
			/>
		</>
	);
}
