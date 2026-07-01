import type { Database } from "../lib/db/client.server";
import {
  eventsByDay,
  topLocations as repoTopLocations,
} from "../repositories/analytics.repository.server";

export interface DailyRollup {
  day: string;
  total: number;
  byType: Record<string, number>;
}

export async function getDashboardRollup(
  db: Database,
  shopId: string,
  days = 30,
): Promise<DailyRollup[]> {
  const rows = await eventsByDay(db, shopId, days);
  const map = new Map<string, DailyRollup>();
  for (const r of rows) {
    const day = r.day;
    const entry = map.get(day) ?? { day, total: 0, byType: {} };
    entry.total += Number(r.count);
    entry.byType[r.eventType] = Number(r.count);
    map.set(day, entry);
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

export async function getTopLocations(db: Database, shopId: string, days = 30) {
  return repoTopLocations(db, shopId, days);
}
