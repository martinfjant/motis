import { expect, test } from "vitest";
import { formatMeetingAt, toLocalStamp } from "./meeting-time";

test("formats meeting time as DD-MM-YYYY", () => {
	expect(formatMeetingAt("2026-11-20T18:00")).toBe("20-11-2026 18:00");
	expect(formatMeetingAt("2026-03-05")).toBe("05-03-2026");
	expect(formatMeetingAt("trasig")).toBe("trasig");
});

test("local stamp uses wall-clock time", () => {
	expect(toLocalStamp(new Date(2026, 10, 20, 18, 3))).toBe("2026-11-20T18:03");
});
