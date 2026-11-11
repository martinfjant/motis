const PARTS = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/**
 * "2026-11-20T18:00" → "20-11-2026 18:00".
 * Meeting times are stored as wall-clock time without a zone, so this only
 * rearranges the parts and server and browser render the same text.
 */
export function formatMeetingAt(value: string): string {
	const m = PARTS.exec(value);
	if (!m) return value;
	const [, y, mo, d, h, mi] = m;
	const day = `${d}-${mo}-${y}`;
	return h ? `${day} ${h}:${mi}` : day;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A Date as local wall-clock "YYYY-MM-DDTHH:MM", the format times are stored in. */
export function toLocalStamp(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Instants (stored as UTC) are shown in Swedish time, so server and browser
// render the same text wherever they run.
const STOCKHOLM = new Intl.DateTimeFormat("sv-SE", {
	timeZone: "Europe/Stockholm",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

/** "2026-11-11T01:47:31.000Z" → "11-11-2026 02:47" (Swedish time). */
export function formatInstant(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		STOCKHOLM.formatToParts(date).find((p) => p.type === type)?.value ?? "";
	return `${part("day")}-${part("month")}-${part("year")} ${part("hour")}:${part("minute")}`;
}
