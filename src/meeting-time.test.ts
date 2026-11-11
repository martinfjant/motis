import { expect, test } from "vitest";
import { formatInstant, formatMeetingAt, toLocalStamp } from "./meeting-time";

test("formats meeting time as DD-MM-YYYY", () => {
	expect(formatMeetingAt("2026-11-20T18:00")).toBe("20-11-2026 18:00");
	expect(formatMeetingAt("2026-03-05")).toBe("05-03-2026");
	expect(formatMeetingAt("trasig")).toBe("trasig");
});

test("local stamp uses wall-clock time", () => {
	expect(toLocalStamp(new Date(2026, 10, 20, 18, 3))).toBe("2026-11-20T18:03");
});

test("instants are shown in Swedish time, summer and winter", () => {
	expect(formatInstant("2026-11-11T01:47:31.000Z")).toBe("11-11-2026 02:47");
	expect(formatInstant("2026-07-01T10:05:00.000Z")).toBe("01-07-2026 12:05");
});
