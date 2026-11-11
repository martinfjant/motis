const PARTS = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/**
 * "2026-11-20T18:00" → "fredag 20 november 2026 kl. 18:00".
 * Meeting times are stored as wall-clock time without a zone, so this builds
 * a local Date from the parts and server and browser render the same text.
 */
export function formatMeetingAt(value: string): string {
	const m = PARTS.exec(value);
	if (!m) return value;
	const [, y, mo, d, h, mi] = m;
	const date = new Date(Number(y), Number(mo) - 1, Number(d));
	const day = date.toLocaleDateString("sv-SE", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	return h ? `${day} kl. ${h}:${mi}` : day;
}
