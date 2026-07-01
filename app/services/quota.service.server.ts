import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import { quotaUsage, shops, type Plan } from "../lib/db/schema";
import { countLocations } from "../repositories/location.repository.server";
import { countImportsThisMonth } from "../repositories/import.repository.server";
import { getPlan } from "../repositories/subscription.repository.server";
import { PLAN_FREE } from "../lib/billing/plans";

// Fallback used only when the DB has no matching plan row (e.g. tests that skip
// seeding, or a shop pointing at a since-deactivated legacy tier). Mirrors the
// canonical free-plan constant (3 locations, OSM/CSV) so gating stays correct
// even off the DB path.
const DEFAULT_FREE_PLAN: Plan = PLAN_FREE;

export async function getPlanForShop(db: Database, shopId: string): Promise<Plan> {
  const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
  const handle = shop?.planHandle ?? "free";
  const plan = await getPlan(db, handle);
  return plan ?? DEFAULT_FREE_PLAN;
}

export class QuotaExceededError extends Error {
  constructor(
    public readonly kind: "locations" | "imports" | "storefront_requests",
    public readonly plan: string,
    public readonly cap: number,
    public readonly current: number,
  ) {
    super(`Quota exceeded: ${kind} (${current}/${cap} on plan "${plan}")`);
    this.name = "QuotaExceededError";
  }
}

/**
 * Thrown when a shop's plan doesn't include a requested feature (a premium
 * widget type, XLSX import, Google Maps, …). Mirrors QuotaExceededError so
 * routes can catch both and surface a "upgrade to unlock" message. Feature
 * gating is SERVER-SIDE — never trusted to the client.
 */
export class PlanFeatureError extends Error {
  constructor(
    public readonly feature: string,
    public readonly plan: string,
  ) {
    super(`Feature not available on plan "${plan}": ${feature}`);
    this.name = "PlanFeatureError";
  }
}

export async function assertLocationQuota(db: Database, shopId: string, adding = 1) {
  const plan = await getPlanForShop(db, shopId);
  const current = await countLocations(db, shopId);
  if (current + adding > plan.maxLocations) {
    throw new QuotaExceededError("locations", plan.handle, plan.maxLocations, current);
  }
}

export async function assertImportQuota(db: Database, shopId: string) {
  const plan = await getPlanForShop(db, shopId);
  const current = await countImportsThisMonth(db, shopId);
  if (current + 1 > plan.maxImportsPerMonth) {
    throw new QuotaExceededError("imports", plan.handle, plan.maxImportsPerMonth, current);
  }
}

/**
 * Storefront request limiter. Uses `quota_usage` as an atomic counter per day.
 * Returns false if the cap is exceeded — caller should respond with 429 and
 * NOT leak the cap back to the storefront (plan data is merchant-internal).
 */
export async function incrementStorefrontRequest(
  db: Database,
  shopId: string,
): Promise<boolean> {
  const plan = await getPlanForShop(db, shopId);
  const period = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  await db
    .insert(quotaUsage)
    .values({
      shopId,
      period,
      kind: "storefront_requests",
      value: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [quotaUsage.shopId, quotaUsage.period, quotaUsage.kind],
      set: {
        value: sql`${quotaUsage.value} + 1`,
        updatedAt: new Date(),
      },
    });

  const current = await db
    .select({ value: quotaUsage.value })
    .from(quotaUsage)
    .where(
      and(
        eq(quotaUsage.shopId, shopId),
        eq(quotaUsage.period, period),
        eq(quotaUsage.kind, "storefront_requests"),
      ),
    )
    .get();

  return (current?.value ?? 1) <= plan.maxStorefrontRequestsPerDay;
}
