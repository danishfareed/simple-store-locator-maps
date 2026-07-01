import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: { d1: D1Database; db: Database } | null = null;

/** Build a Drizzle client bound to the request-scoped D1 binding. */
export function getDb(d1: D1Database): Database {
  if (cached && cached.d1 === d1) return cached.db;
  const db = drizzle(d1, { schema, logger: false });
  cached = { d1, db };
  return db;
}

export { schema };
