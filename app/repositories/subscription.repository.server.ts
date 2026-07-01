import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import {
  subscriptions,
  plans,
  type NewSubscription,
  type Plan,
  type Subscription,
} from "../lib/db/schema";

export async function getActiveSubscription(
  db: Database,
  shopId: string,
): Promise<Subscription | undefined> {
  return db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.shopId, shopId), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.createdAt))
    .get();
}

export async function recordSubscription(db: Database, row: NewSubscription) {
  return db.insert(subscriptions).values(row).returning().get();
}

export async function updateSubscriptionStatus(
  db: Database,
  id: string,
  status: Subscription["status"],
  patch: Partial<NewSubscription> = {},
) {
  await db
    .update(subscriptions)
    .set({ status, ...patch, updatedAt: new Date() })
    .where(eq(subscriptions.id, id));
}

export async function getPlan(db: Database, handle: string): Promise<Plan | undefined> {
  return db.select().from(plans).where(eq(plans.handle, handle)).get();
}

export async function listPlans(db: Database): Promise<Plan[]> {
  return db.select().from(plans).where(eq(plans.isActive, true)).all();
}
