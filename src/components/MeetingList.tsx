import type { ReactNode } from "react";
import { MeetingTime } from "./DateTime";

/** A list of meetings; fill it with MeetingItem. */
export function MeetingList({ children }: { children: ReactNode }) {
	return <ul className="list-disc pl-6">{children}</ul>;
}

/**
 * One meeting in a list: its title (usually a link), its time (with "om 3
 * dagar" if daysUntil is given), then anything else, like "Starta möte".
 * A marker (e.g. the padlock for a justerat protocol) replaces the bullet.
 */
export function MeetingItem({
	title,
	at,
	daysUntil,
	marker,
	children,
}: {
	title: ReactNode;
	at?: string;
	daysUntil?: number;
	/** Shown instead of the bullet. */
	marker?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<li className={marker ? "relative list-none" : undefined}>
			{marker && (
				<span className="absolute top-0 right-full mr-1.5 flex h-[1lh] items-center">
					{marker}
				</span>
			)}
			{title}
			{at && (
				<>
					{" "}
					<MeetingTime at={at} daysUntil={daysUntil} />
				</>
			)}
			{children && <> {children}</>}
		</li>
	);
}
