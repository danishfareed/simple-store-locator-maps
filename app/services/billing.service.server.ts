import { eq } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import { shops, subscriptions, type Plan } from "../lib/db/schema";
import { newId } from "../lib/utils/slug";
import {
  getActiveSubscription,
  recordSubscription,
  updateSubscriptionStatus,
} from "../repositories/subscription.repository.server";

export interface CreateChargeArgs {
  shopId: string;
  plan: Plan;
  returnUrl: string;
  shopifyCreate: (args: {
    handle: string;
    amount: number;
    currency: string;
    interval: "ANNUAL" | "EVERY_30_DAYS";
    trialDays: number;
    returnUrl: string;
  }) => Promise<{ chargeId: string; confirmationUrl: string }>;
}

/**
 * Requests a charge from Shopify via the provided `shopifyCreate` adapter, and
 * persists a subscription row in `pending` status. The caller redirects the
 * merchant to `confirmationUrl`; on return, we activate via webhook or by
 * re-auth after redirect.
 */
export async function createCharge(
  db: Database,
  args: CreateChargeArgs,
): Promise<{ confirmationUrl: string }> {
  const { plan, returnUrl, shopifyCreate, shopId } = args;
  const shopify = await shopifyCreate({
    handle: plan.handle,
    amount: plan.priceCents / 100,
    currency: plan.currency,
    interval: plan.interval === "annual" ? "ANNUAL" : "EVERY_30_DAYS",
    trialDays: plan.trialDays,
    returnUrl,
  });

  await recordSubscription(db, {
    id: newId(),
    shopId,
    planHandle: plan.handle,
    shopifyChargeId: shopify.chargeId,
    status: "pending",
    confirmationUrl: shopify.confirmationUrl,
    trialEndsAt:
      plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 86_400_000) : null,
  });

  return { confirmationUrl: shopify.confirmationUrl };
}

/**
 * Mark a subscription active & flip the shop's plan handle. Called after the
 * `app_subscriptions/update` webhook fires `status: ACTIVE`, or on a post-
 * confirmation admin route check.
 */
export async function activateSubscription(
  db: Database,
  shopId: string,
  chargeId: string,
) {
  const sub = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.shopifyChargeId, chargeId))
    .get();
  if (!sub) return;
  await updateSubscriptionStatus(db, sub.id, "active", {
    currentPeriodEndsAt: new Date(Date.now() + 30 * 86_400_000),
  });
  await db.update(shops).set({ planHandle: sub.planHandle, updatedAt: new Date() }).where(eq(shops.id, shopId));
}

export async function cancelSubscription(db: Database, shopId: string) {
  const sub = await getActiveSubscription(db, shopId);
  if (!sub) return;
  await updateSubscriptionStatus(db, sub.id, "cancelled", {
    cancelledAt: new Date(),
  });
  await db.update(shops).set({ planHandle: "free", updatedAt: new Date() }).where(eq(shops.id, shopId));
}
