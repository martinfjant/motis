import { useRef } from "react";
import {
	type CarryOverFlags,
	type PointState,
	type ProtocolItem,
	type ProtocolValue,
	pointState,
	secretaryNames,
	unfinishedPoints,
} from "#/server/items";
import { type MeetingContext, ProtocolPoint } from "../ProtocolPoint";

/**
 * The points of a protocol during the meeting (and while editing a closed
 * one), each as its type's Form. The current point, the first one neither
 * done nor tabled, has its number in a circle.
 */
export function MeetingPointList({
	items,
	onSave,
	onCarryOver,
	onDelete,
	...context
}: Omit<MeetingContext, "secretaries" | "unfinished"> & {
	items: ProtocolItem[];
	onSave: (itemId: string) => (value: ProtocolValue) => Promise<boolean>;
	onCarryOver: (itemId: string) => (flags: CarryOverFlags) => Promise<boolean>;
	onDelete: (item: ProtocolItem) => void;
}) {
	const list = useRef<HTMLOListElement>(null);
	if (items.length === 0) return <p>Inga punkter ännu.</p>;
	const secretaries = secretaryNames(items);
	const unfinished = unfinishedPoints(items);
	const current = items.findIndex((i) => pointState(i.value) === "open");
	return (
		// The numbers are drawn here (a list marker can't have a circle), so
		// role="list" keeps Safari announcing it as a list.
		// biome-ignore lint/a11y/useSemanticElements: it is an <ol>; Safari drops its list role without markers
		<ol
			ref={list}
			// biome-ignore lint/a11y/noRedundantRoles: Safari drops the list role without markers
			role="list"
			className="list-none py-5 pl-8 space-y-10 sm:p-5"
		>
			{items.map((item, i) => (
				<li
					key={item.id}
					className="relative pl-2"
					aria-current={i === current ? "step" : undefined}
					data-point-id={item.id}
					data-point-state={pointState(item.value)}
				>
					<PointNumber
						n={i + 1}
						current={i === current}
						state={pointState(item.value)}
					/>
					<ProtocolPoint
						{...context}
						item={item}
						secretaries={secretaries}
						unfinished={unfinished}
						onSave={async (value) => {
							const ok = await onSave(item.id)(value);
							// Finished ("Klar", or a choice that settles it): on to the next.
							if (ok && value.done)
								requestAnimationFrame(() =>
									focusNextOpen(list.current, item.id),
								);
							return ok;
						}}
						onCarryOver={onCarryOver(item.id)}
						onDelete={() => onDelete(item)}
					/>
				</li>
			))}
		</ol>
	);
}

/**
 * A point's number, in the margin level with its title: in a teal circle for
 * the current point, muted like the rest of a done point.
 */
function PointNumber({
	n,
	current,
	state,
}: {
	n: number;
	current: boolean;
	state: PointState;
}) {
	return (
		<span
			aria-hidden="true"
			className="absolute top-0 right-full mr-1 flex h-7 items-center justify-end"
		>
			{current ? (
				<span className="flex size-7 items-center justify-center rounded-full bg-accent-strong font-bold text-on-accent ring-2 ring-accent/30">
					{n}
				</span>
			) : (
				<span className={state === "done" ? "text-muted" : undefined}>
					{n}.
				</span>
			)}
		</span>
	);
}

/**
 * Moves focus to the next point not yet dealt with after the one just
 * finished (wrapping round to earlier ones), to its first control, and
 * scrolls it into view.
 */
function focusNextOpen(list: HTMLOListElement | null, afterId: string) {
	if (!list) return;
	const points = [...list.querySelectorAll<HTMLLIElement>(":scope > li")];
	const i = points.findIndex((li) => li.dataset.pointId === afterId);
	const next = [...points.slice(i + 1), ...points.slice(0, i)].find(
		(li) => li.dataset.pointState === "open",
	);
	if (!next) return;
	const control = [
		...next.querySelectorAll<HTMLElement>("input, select, textarea, button"),
	].find(
		(el) =>
			!(el as HTMLButtonElement).disabled && el.checkVisibility?.() !== false,
	);
	(control ?? next).focus({ preventScroll: true });
	const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
	next.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
}
