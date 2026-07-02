// Pure, dependency-free open/closed logic shared by the admin dashboard and
// the storefront widget bundle. Type-only import keeps this file free of any
// server runtime dependency so it can be bundled client-side.
import type { LocationHours } from "../db/schema";

export interface OpenNowResult {
  open: boolean;
  label: string;
  nextChange?: string;
}

/**
 * Determine whether a location is open at `now`, optionally evaluated in a
 * specific IANA `timeZone`. When `timeZone` is omitted, the Date's own local
 * weekday/hour/minute are used (i.e. the caller's system zone).
 *
 * `hours` keys are ISO weekdays as strings: "1" (Monday) … "7" (Sunday).
 */
export function isOpenNow(
  hours: LocationHours | null | undefined,
  now: Date,
  timeZone?: string,
): OpenNowResult {
  if (!hours) {
    return { open: false, label: "Closed" };
  }

  const { isoWeekday, minutesOfDay } = resolveNow(now, timeZone);
  const todaysHours = hours[String(isoWeekday)];

  if (!todaysHours || todaysHours.length === 0) {
    return { open: false, label: "Closed" };
  }

  const openIntervals = todaysHours.filter((interval) => !interval.closed);
  if (openIntervals.length === 0) {
    return { open: false, label: "Closed" };
  }

  // Currently within an interval? An interval whose close time is <= its
  // open time (e.g. 22:00->02:00) wraps past midnight, so "within" means
  // "at/after open OR before close" rather than a simple bounded range.
  for (const interval of openIntervals) {
    const openMin = toMinutes(interval.open);
    const closeMin = toMinutes(interval.close);
    const isOvernight = closeMin <= openMin;
    const openNow = isOvernight
      ? minutesOfDay >= openMin || minutesOfDay < closeMin
      : minutesOfDay >= openMin && minutesOfDay < closeMin;
    if (openNow) {
      return {
        open: true,
        label: "Open now",
        nextChange: interval.close,
      };
    }
  }

  // Not open now — is there a later interval opening today?
  const upcoming = openIntervals
    .filter((interval) => toMinutes(interval.open) > minutesOfDay)
    .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];

  if (upcoming) {
    return {
      open: false,
      label: `Opens ${formatLabel(upcoming.open)}`,
      nextChange: upcoming.open,
    };
  }

  return { open: false, label: "Closed" };
}

function resolveNow(
  now: Date,
  timeZone?: string,
): { isoWeekday: number; minutesOfDay: number } {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
    let hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "0";

    // Intl may render midnight as "24" with hour12: false in some engines.
    let hour = parseInt(hourStr, 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(minuteStr, 10);

    return {
      isoWeekday: shortWeekdayToIso(weekdayStr),
      minutesOfDay: hour * 60 + minute,
    };
  }

  // Native Date: getDay() is 0=Sun..6=Sat; convert to ISO 1=Mon..7=Sun.
  const day = now.getDay();
  const isoWeekday = day === 0 ? 7 : day;
  const minutesOfDay = now.getHours() * 60 + now.getMinutes();
  return { isoWeekday, minutesOfDay };
}

const SHORT_WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function shortWeekdayToIso(short: string): number {
  return SHORT_WEEKDAYS[short] ?? 1;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

/** "09:00" -> "9:00" (drop a leading zero on the hour for a friendlier label). */
function formatLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${parseInt(h, 10)}:${m}`;
}
