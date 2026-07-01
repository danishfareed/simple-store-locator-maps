// Test helper: builds an in-memory SQLite database (via better-sqlite3) that
// stands in for D1 in service-level tests. Applies every migration under
// drizzle/migrations/*.sql in filename order, then wraps the connection with
// drizzle-orm/better-sqlite3. The runtime query API (select/insert/update/
// delete/where/...) is identical to the D1 driver used in production, so the
// result is cast to the app's `Database` type for call-site compatibility.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../app/lib/db/schema";
import type { Database } from "../../app/lib/db/client.server";

const MIGRATIONS_DIR = join(__dirname, "../../drizzle/migrations");

/** Build a fresh in-memory SQLite DB with all migrations applied. */
export async function makeTestDb(): Promise<Database> {
  const sqlite = new BetterSqlite3(":memory:");
  sqlite.pragma("foreign_keys = ON");

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      sqlite.exec(statement);
    }
  }

  const db = drizzle(sqlite, { schema });
  return db as unknown as Database;
}

/** Seed a minimal shop graph: shop + one location + one widget + one analytics event. */
export async function seedShop(db: Database, shopId: string): Promise<void> {
  const now = new Date();

  await db.insert(schema.shops).values({
    id: shopId,
    shopDomain: `${shopId}.myshopify.com`,
    planHandle: "free",
    installedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.locations).values({
    id: `${shopId}-loc-1`,
    shopId,
    name: "Test Location",
    slug: "test-location",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.widgets).values({
    id: `${shopId}-widget-1`,
    shopId,
    handle: "default",
    name: "Default Widget",
    provider: "leaflet",
    config: {},
    isPublished: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.analyticsEvents).values({
    id: `${shopId}-event-1`,
    shopId,
    eventType: "view",
    createdAt: now,
  });
}

/** Count rows in `tableName` scoped to `shopId` (or the shop's own id column for "shops"). */
export async function countRows(
  db: Database,
  tableName: string,
  shopId: string,
): Promise<number> {
  const shopScopedColumn: Record<string, string> = {
    shops: "id",
    sessions: "shop",
    locations: "shop_id",
    widgets: "shop_id",
    imports: "shop_id",
    analytics_events: "shop_id",
    quota_usage: "shop_id",
    subscriptions: "shop_id",
    audit_log: "shop_id",
  };
  const column = shopScopedColumn[tableName] ?? "shop_id";

  const raw = (db as unknown as { $client: BetterSqlite3.Database }).$client;
  const row = raw
    .prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE ${column} = ?`)
    .get(shopId) as { count: number };
  return row.count;
}
