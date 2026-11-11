import { expect, test } from "vitest";
import { formatMeetingAt } from "./meeting-time";

test("formats meeting time as DD-MM-YYYY", () => {
	expect(formatMeetingAt("2026-11-20T18:00")).toBe("20-11-2026 kl. 18:00");
	expect(formatMeetingAt("2026-03-05")).toBe("05-03-2026");
	expect(formatMeetingAt("trasig")).toBe("trasig");
});
