import { and, eq } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import { widgets, type NewWidget, type Widget } from "../lib/db/schema";

export async function listWidgets(db: Database, shopId: string) {
  return db.select().from(widgets).where(eq(widgets.shopId, shopId)).all();
}

export async function getWidgetByHandle(db: Database, shopId: string, handle: string) {
  return db
    .select()
    .from(widgets)
    .where(and(eq(widgets.shopId, shopId), eq(widgets.handle, handle)))
    .get();
}

export async function getWidget(db: Database, shopId: string, id: string) {
  return db
    .select()
    .from(widgets)
    .where(and(eq(widgets.shopId, shopId), eq(widgets.id, id)))
    .get();
}

export async function upsertWidget(db: Database, row: NewWidget): Promise<Widget> {
  return db
    .insert(widgets)
    .values(row)
    .onConflictDoUpdate({
      target: [widgets.shopId, widgets.handle],
      set: {
        name: row.name,
        provider: row.provider,
        type: row.type,
        config: row.config,
        isPublished: row.isPublished,
        updatedAt: new Date(),
      },
    })
    .returning()
    .get();
}

/**
 * Update an existing widget by id (shop-scoped). Unlike `upsertWidget` (which
 * conflicts on `(shopId, handle)` and is meant for create-or-replace-by-handle
 * flows), this targets the row by primary key so it works even when the
 * handle itself is changing — an insert keyed by the old id would otherwise
 * collide with the row's own primary key.
 */
export async function updateWidget(
  db: Database,
  shopId: string,
  id: string,
  patch: Partial<NewWidget>,
): Promise<Widget | undefined> {
  return db
    .update(widgets)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(widgets.shopId, shopId), eq(widgets.id, id)))
    .returning()
    .get();
}

export async function deleteWidget(db: Database, shopId: string, id: string) {
  await db.delete(widgets).where(and(eq(widgets.shopId, shopId), eq(widgets.id, id)));
}
