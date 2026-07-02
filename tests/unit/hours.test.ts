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

  describe("overnight (cross-midnight) intervals", () => {
    // Wed 22:00–02:00, every other day closed.
    const OVERNIGHT_HOURS: LocationHours = {
      "1": [],
      "2": [],
      "3": [{ open: "22:00", close: "02:00" }],
      "4": [],
      "5": [],
      "6": [],
      "7": [],
    };

    it("is open late in the evening (Wed 23:30 America/New_York)", () => {
      const now = new Date("2026-07-02T03:30:00Z"); // 23:30 EDT Wed
      const result = isOpenNow(OVERNIGHT_HOURS, now, TZ);
      expect(result.open).toBe(true);
      expect(result.label).toBe("Open now");
      expect(result.nextChange).toBe("02:00");
    });

    it("is open just after midnight, still keyed to the opening weekday (Wed 01:00 America/New_York)", () => {
      // The interval is keyed on Wednesday (weekday "3"); 01:00 EDT Wed is
      // still within the Wed 22:00->02:00 window even though clock time is
      // "before" the open time.
      const now = new Date("2026-07-01T05:00:00Z"); // 01:00 EDT Wed
      const result = isOpenNow(OVERNIGHT_HOURS, now, TZ);
      expect(result.open).toBe(true);
      expect(result.label).toBe("Open now");
      expect(result.nextChange).toBe("02:00");
    });

    it("is closed mid-afternoon (Wed 15:00 America/New_York)", () => {
      const now = new Date("2026-07-01T19:00:00Z"); // 15:00 EDT Wed
      const result = isOpenNow(OVERNIGHT_HOURS, now, TZ);
      expect(result.open).toBe(false);
      expect(result.label).toBe("Opens 22:00");
    });

    it("a normal (non-overnight) interval still behaves correctly", () => {
      const now = new Date("2026-07-01T14:00:00Z"); // 10:00 EDT Wed
      const result = isOpenNow(STANDARD_HOURS, now, TZ);
      expect(result.open).toBe(true);
      expect(result.label).toBe("Open now");
      expect(result.nextChange).toBe("17:00");
    });
  });
});
