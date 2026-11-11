import type { ReactNode } from "react";
import { MeetingTime } from "./DateTime";

/** A list of meetings; fill it with MeetingItem. */
export function MeetingList({ children }: { children: ReactNode }) {
	return <ul>{children}</ul>;
}

/**
 * One meeting in a list: its title (usually a link), its time (with "om 3
 * dagar" if daysUntil is given), then anything else, like "Starta möte".
 */
export function MeetingItem({
	title,
	at,
	daysUntil,
	children,
}: {
	title: ReactNode;
	at?: string;
	daysUntil?: number;
	children?: ReactNode;
}) {
	return (
		<li>
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
