import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import { imports, type ImportJob, type NewImportJob } from "../lib/db/schema";

export async function countImportsThisMonth(
  db: Database,
  shopId: string,
): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(imports)
    .where(and(eq(imports.shopId, shopId), gte(imports.createdAt, monthStart)))
    .get();
  return row?.count ?? 0;
}

export async function createImport(db: Database, row: NewImportJob): Promise<ImportJob> {
  return db.insert(imports).values(row).returning().get();
}

export async function getImport(db: Database, shopId: string, id: string) {
  return db
    .select()
    .from(imports)
    .where(and(eq(imports.shopId, shopId), eq(imports.id, id)))
    .get();
}

export async function listImports(db: Database, shopId: string, limit = 20) {
  return db
    .select()
    .from(imports)
    .where(eq(imports.shopId, shopId))
    .orderBy(desc(imports.createdAt))
    .limit(limit)
    .all();
}

export async function updateImportStatus(
  db: Database,
  id: string,
  patch: Partial<NewImportJob>,
) {
  await db.update(imports).set(patch).where(eq(imports.id, id));
}
