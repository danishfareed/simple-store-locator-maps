import { and, eq, sql, gt, like, or, inArray, asc, desc } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import { locations, type Location, type NewLocation } from "../lib/db/schema";

export async function countLocations(db: Database, shopId: string): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(locations)
    .where(eq(locations.shopId, shopId))
    .get();
  return row?.count ?? 0;
}

/**
 * All existing slugs for a shop, lower-cased into a Set. Used by the importer to
 * de-collide slugs up front (one query) instead of a per-row DB round-trip.
 */
export async function getShopSlugs(db: Database, shopId: string): Promise<Set<string>> {
  const rows = await db
    .select({ slug: locations.slug })
    .from(locations)
    .where(eq(locations.shopId, shopId))
    .all();
  return new Set(rows.map((r) => r.slug));
}

/**
 * The set of `externalId`s already present for a shop (nulls excluded). Used by
 * the importer to tell UPDATES (matching externalId → upsert) apart from
 * NET-NEW rows when enforcing the plan's location cap.
 */
export async function getShopExternalIds(
  db: Database,
  shopId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ externalId: locations.externalId })
    .from(locations)
    .where(eq(locations.shopId, shopId))
    .all();
  const set = new Set<string>();
  for (const r of rows) if (r.externalId) set.add(r.externalId);
  return set;
}

export interface ListLocationsOptions {
  query?: string;
  status?: "active" | "inactive" | "draft";
  limit?: number;
  cursor?: string;
  order?: "name" | "createdAt";
}

export async function listLocations(
  db: Database,
  shopId: string,
  opts: ListLocationsOptions = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const where = [eq(locations.shopId, shopId)];
  if (opts.status) where.push(eq(locations.status, opts.status));
  if (opts.query) {
    const q = `%${opts.query}%`;
    where.push(
      or(
        like(locations.name, q),
        like(locations.city, q),
        like(locations.region, q),
        like(locations.postalCode, q),
      )!,
    );
  }
  if (opts.cursor) where.push(gt(locations.id, opts.cursor));

  const orderCol = opts.order === "createdAt" ? locations.createdAt : locations.name;
  const rows = await db
    .select()
    .from(locations)
    .where(and(...where))
    .orderBy(asc(orderCol))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;
  return { items, nextCursor };
}

export async function getLocationById(db: Database, shopId: string, id: string) {
  return db
    .select()
    .from(locations)
    .where(and(eq(locations.shopId, shopId), eq(locations.id, id)))
    .get();
}

export async function getLocationBySlug(db: Database, shopId: string, slug: string) {
  return db
    .select()
    .from(locations)
    .where(and(eq(locations.shopId, shopId), eq(locations.slug, slug)))
    .get();
}

export async function createLocation(db: Database, row: NewLocation): Promise<Location> {
  const inserted = await db.insert(locations).values(row).returning().get();
  return inserted;
}

export async function updateLocation(
  db: Database,
  shopId: string,
  id: string,
  patch: Partial<NewLocation>,
): Promise<Location | undefined> {
  return db
    .update(locations)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(locations.shopId, shopId), eq(locations.id, id)))
    .returning()
    .get();
}

export async function deleteLocation(db: Database, shopId: string, id: string) {
  await db
    .delete(locations)
    .where(and(eq(locations.shopId, shopId), eq(locations.id, id)));
}

export async function bulkDeleteLocations(db: Database, shopId: string, ids: string[]) {
  if (ids.length === 0) return 0;
  const before = await countLocations(db, shopId);
  await db
    .delete(locations)
    .where(and(eq(locations.shopId, shopId), inArray(locations.id, ids)));
  const after = await countLocations(db, shopId);
  return before - after;
}

/**
 * Bulk status change (activate/deactivate/etc.), shop-scoped and id-scoped so
 * a merchant can never affect another shop's rows via a crafted id list.
 */
export async function setLocationsStatus(
  db: Database,
  shopId: string,
  ids: string[],
  status: "active" | "inactive" | "draft",
): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(locations)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(locations.shopId, shopId), inArray(locations.id, ids)))
    .returning({ id: locations.id })
    .all();
  return rows.length;
}

/**
 * Bounding-box pre-filter for storefront search. We compute a rough lat/lng
 * window from the radius and let the caller do precise Haversine ranking in
 * application code — D1 has no spatial extensions and Haversine in SQL is both
 * slow and loses the lat/lng index.
 */
export async function findLocationsInBbox(
  db: Database,
  shopId: string,
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  limit: number,
) {
  return db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.shopId, shopId),
        eq(locations.status, "active"),
        sql`${locations.latitude} BETWEEN ${bbox.minLat} AND ${bbox.maxLat}`,
        sql`${locations.longitude} BETWEEN ${bbox.minLng} AND ${bbox.maxLng}`,
      ),
    )
    .orderBy(desc(locations.createdAt))
    .limit(limit)
    .all();
}
