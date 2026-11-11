import { RecordedValue } from "../ProtocolView";
import { PointActions } from "./PointActions";
import { hasValue, type PointProps } from "./point";

/** A done point: what was recorded, as text, and "Ändra". */
export function DoneView(props: PointProps) {
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
