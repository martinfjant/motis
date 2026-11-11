import { canCarryOver } from "#/server/items";
import { Button } from "../Button";
import type { PointProps } from "./point";

/**
 * The bottom of a point. While the point is open: the follow-up checkbox
 * (where it applies), then Klar, Avbryt (if reopened), Bordlägg (only the
 * first time; a point that has been done can't be tabled) and Ta bort
 * punkten. When done: just Ändra, since the follow-up choice then shows as
 * text.
 */
export function PointActions({
	item,
	done,
	reopened,
	edit,
	cancel,
	carryOver,
	remove,
	submit,
	editLabel = "Ändra",
}: PointProps & {
	/** Show "Klar" (a submit button). Points that save on a choice hide it. */
	submit: boolean;
	editLabel?: string;
}) {
	if (done)
		return (
			<p>
				<Button onClick={edit}>{editLabel}</Button>
			</p>
		);

	const carriable = canCarryOver(item.type);
	const followUpId = `${item.id}-followup`;
	return (
		<>
			{carriable && (
				<p>
					{/* Keyed on the saved state so it shows what the server has. */}
					<input
						key={String(!!item.value.followUp)}
						id={followUpId}
						type="checkbox"
						defaultChecked={!!item.value.followUp}
						onChange={(e) => carryOver({ followUp: e.currentTarget.checked })}
					/>{" "}
					<label htmlFor={followUpId}>Följ upp på nästa möte</label>
				</p>
			)}
			<p>
				{submit && (
					<>
						<Button type="submit">Klar</Button>{" "}
					</>
				)}
				{reopened && (
					<>
						<Button onClick={cancel}>Avbryt</Button>{" "}
					</>
				)}
				{carriable && !reopened && (
					<>
						<Button onClick={() => carryOver({ tabled: true })}>
							Bordlägg
						</Button>{" "}
					</>
				)}
				<Button onClick={remove}>Ta bort punkten</Button>
			</p>
		</>
	);
}
