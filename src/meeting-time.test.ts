import { expect, test } from "vitest";
import { formatMeetingAt } from "./meeting-time";

test("formats meeting time in Swedish", () => {
	expect(formatMeetingAt("2026-11-20T18:00")).toBe(
		"fredag 20 november 2026 kl. 18:00",
	);
	expect(formatMeetingAt("2026-11-20")).toBe("fredag 20 november 2026");
	expect(formatMeetingAt("trasig")).toBe("trasig");
});
