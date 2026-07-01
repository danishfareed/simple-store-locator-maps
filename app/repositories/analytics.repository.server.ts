import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import { analyticsEvents, type NewAnalyticsEvent } from "../lib/db/schema";

export async function recordEvent(db: Database, evt: NewAnalyticsEvent) {
  await db.insert(analyticsEvents).values(evt);
}

export async function recordEvents(db: Database, evts: NewAnalyticsEvent[]) {
  if (evts.length === 0) return;
  await db.insert(analyticsEvents).values(evts);
}

export async function eventsByDay(db: Database, shopId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({
      day: sql<string>`strftime('%Y-%m-%d', ${analyticsEvents.createdAt} / 1000, 'unixepoch')`,
      eventType: analyticsEvents.eventType,
      count: sql<number>`count(*)`,
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.shopId, shopId), gte(analyticsEvents.createdAt, since)))
    .groupBy(
      sql`strftime('%Y-%m-%d', ${analyticsEvents.createdAt} / 1000, 'unixepoch')`,
      analyticsEvents.eventType,
    )
    .orderBy(
      sql`strftime('%Y-%m-%d', ${analyticsEvents.createdAt} / 1000, 'unixepoch') DESC`,
    )
    .all();
  return rows;
}

export async function topLocations(db: Database, shopId: string, days = 30, limit = 10) {
  const since = new Date(Date.now() - days * 86_400_000);
  return db
    .select({
      locationId: analyticsEvents.locationId,
      count: sql<number>`count(*)`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.shopId, shopId),
        gte(analyticsEvents.createdAt, since),
        sql`${analyticsEvents.locationId} is not null`,
      ),
    )
    .groupBy(analyticsEvents.locationId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(limit)
    .all();
}
