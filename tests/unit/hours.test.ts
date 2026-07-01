import { describe, it, expect } from "vitest";
import { isOpenNow } from "../../app/lib/utils/hours";
import type { LocationHours } from "../../app/lib/db/schema";

const TZ = "America/New_York";

// Mon–Fri 09:00–17:00, closed Sat/Sun.
const STANDARD_HOURS: LocationHours = {
  "1": [{ open: "09:00", close: "17:00" }],
  "2": [{ open: "09:00", close: "17:00" }],
  "3": [{ open: "09:00", close: "17:00" }],
  "4": [{ open: "09:00", close: "17:00" }],
  "5": [{ open: "09:00", close: "17:00" }],
  "6": [{ closed: true, open: "00:00", close: "00:00" }],
  "7": [],
};

describe("isOpenNow", () => {
  it("is open during business hours (Wed 10:00 America/New_York)", () => {
    const now = new Date("2026-07-01T14:00:00Z"); // 10:00 EDT Wed
    const result = isOpenNow(STANDARD_HOURS, now, TZ);
    expect(result.open).toBe(true);
    expect(result.label).toBe("Open now");
    expect(result.nextChange).toBe("17:00");
  });

  it("is closed before opening (Wed 08:00 America/New_York)", () => {
    const now = new Date("2026-07-01T12:00:00Z"); // 08:00 EDT Wed
    const result = isOpenNow(STANDARD_HOURS, now, TZ);
    expect(result.open).toBe(false);
    expect(result.label).toBe("Opens 9:00");
    expect(result.nextChange).toBe("09:00");
  });

  it("is closed after closing (Wed 18:00 America/New_York)", () => {
    const now = new Date("2026-07-01T22:00:00Z"); // 18:00 EDT Wed
    const result = isOpenNow(STANDARD_HOURS, now, TZ);
    expect(result.open).toBe(false);
    expect(result.label).toBe("Closed");
  });

  it("treats a closed:true day as closed even within the nominal window", () => {
    // 2026-06-27 is a Saturday; 14:00 UTC = 10:00 EDT.
    const now = new Date("2026-06-27T14:00:00Z");
    const result = isOpenNow(STANDARD_HOURS, now, TZ);
    expect(result.open).toBe(false);
    expect(result.label).toBe("Closed");
  });

  it("treats a day with an empty entries array as closed", () => {
    // 2026-07-05 is a Sunday; 14:00 UTC = 10:00 EDT.
    const now = new Date("2026-07-05T14:00:00Z");
    const result = isOpenNow(STANDARD_HOURS, now, TZ);
    expect(result.open).toBe(false);
    expect(result.label).toBe("Closed");
  });

  it("treats missing hours entirely as closed", () => {
    const now = new Date("2026-07-01T14:00:00Z");
    expect(isOpenNow({}, now, TZ)).toMatchObject({ open: false, label: "Closed" });
    expect(
      isOpenNow(undefined as unknown as LocationHours, now, TZ),
    ).toMatchObject({ open: false, label: "Closed" });
  });

  it("treats a missing weekday key as closed", () => {
    const now = new Date("2026-07-01T14:00:00Z"); // Wed
    const noWednesday: LocationHours = {
      "1": [{ open: "09:00", close: "17:00" }],
    };
    expect(isOpenNow(noWednesday, now, TZ)).toMatchObject({
      open: false,
      label: "Closed",
    });
  });

  it("falls back to the Date's local values when no timeZone is given", () => {
    // Construct a local Date directly (no TZ conversion) so the test is
    // independent of the host machine's zone: Wed 10:00 local.
    const now = new Date(2026, 6, 1, 10, 0, 0); // month is 0-indexed: 6 = July
    const result = isOpenNow(STANDARD_HOURS, now);
    expect(result.open).toBe(true);
    expect(result.label).toBe("Open now");
  });
});
