import { desc, eq } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import { shops, subscriptions } from "../lib/db/schema";
import { newId } from "../lib/utils/slug";
import {
  BILLING_KEY_PREMIUM_ANNUAL,
  BILLING_KEY_PREMIUM_MONTHLY,
  PLAN_PREMIUM,
  PREMIUM_TRIAL_DAYS,
  type PlanHandle,
} from "../lib/billing/plans";
import {
  updateSubscriptionStatus,
} from "../repositories/subscription.repository.server";

/** Billing cadence chosen at checkout — maps to a Shopify billing key. */
export type BillingCadence = "monthly" | "annual";

/** The literal Shopify billing keys configured in BILLING_CONFIG. */
export type BillingKey =
  | typeof BILLING_KEY_PREMIUM_MONTHLY
  | typeof BILLING_KEY_PREMIUM_ANNUAL;

/** Translate a chosen cadence to the Shopify billing key (from BILLING_CONFIG). */
export function billingKeyForCadence(cadence: BillingCadence): BillingKey {
  return cadence === "annual"
    ? BILLING_KEY_PREMIUM_ANNUAL
    : BILLING_KEY_PREMIUM_MONTHLY;
}

/**
 * Record a `pending` premium subscription before handing the merchant off to
 * Shopify's managed confirmation page.
 *
 * IMPORTANT: `@shopify/shopify-app-react-router`'s `billing.request` returns
 * `Promise<never>` — it throws a redirect Response to Shopify's confirmation
 * URL rather than returning it. So the ROUTE is responsible for calling
 * `auth.billing.request(...)` (which redirects); this function only persists
 * our side of the state. The real Shopify charge id arrives later on the
 * `app_subscriptions/update` webhook, so we store `null` here and backfill it
 * in `syncSubscriptionFromShopify`.
 */
export async function recordPendingCharge(
  db: Database,
  shopId: string,
): Promise<void> {
  await db.insert(subscriptions).values({
    id: newId(),
    shopId,
    planHandle: "premium",
    shopifyChargeId: null,
    status: "pending",
    trialEndsAt:
      PREMIUM_TRIAL_DAYS > 0
        ? new Date(Date.now() + PREMIUM_TRIAL_DAYS * 86_400_000)
        : null,
  });
}

/**
 * The status strings Shopify sends on `app_subscriptions/update`. Uppercase.
 * @see https://shopify.dev/docs/api/webhooks (app_subscriptions/update sample)
 */
type ShopifySubscriptionStatus =
  | "PENDING"
  | "ACTIVE"
  | "CANCELLED"
  | "EXPIRED"
  | "DECLINED"
  | "FROZEN"
  | "ACCEPTED"
  | "DECLINED";

interface AppSubscriptionUpdatePayload {
  app_subscription?: {
    admin_graphql_api_id?: string;
    name?: string;
    status?: string;
    plan_handle?: string;
  };
}

/** Map a Shopify subscription status to our internal subscription status enum. */
function toInternalStatus(status: string): "active" | "cancelled" | "expired" | "declined" | "frozen" | "pending" {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "CANCELLED":
      return "cancelled";
    case "EXPIRED":
      return "expired";
    case "DECLINED":
      return "declined";
    case "FROZEN":
      return "frozen";
    default:
      return "pending";
  }
}

/**
 * Apply an `app_subscriptions/update` webhook to our DB state.
 *
 * With a single paid tier the mapping is simple:
 *   - ACTIVE  → shop.planHandle = "premium", subscription row → active,
 *               and the real charge id (payload `admin_graphql_api_id`) is stored.
 *   - CANCELLED / EXPIRED / DECLINED / FROZEN → downgrade shop.planHandle = "free"
 *               and mark the matching subscription row with that status.
 *   - anything else (PENDING/ACCEPTED) → record status, leave the plan unchanged.
 *
 * The webhook is the source of truth for activation — never trust a client
 * round-trip. Idempotent: safe to receive the same status repeatedly.
 */
export async function syncSubscriptionFromShopify(
  db: Database,
  shopId: string,
  payload: unknown,
): Promise<void> {
  const sub = (payload as AppSubscriptionUpdatePayload).app_subscription;
  const rawStatus = (sub?.status ?? "").toString();
  const status: ShopifySubscriptionStatus = rawStatus.toUpperCase() as ShopifySubscriptionStatus;
  const chargeId = sub?.admin_graphql_api_id ?? null;
  const internal = toInternalStatus(rawStatus);

  // Find the subscription row to update: prefer the row carrying this charge id,
  // else the most recent row for the shop (pending rows have no charge id yet).
  const row =
    (chargeId
      ? await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.shopifyChargeId, chargeId))
          .get()
      : undefined) ??
    (await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.shopId, shopId))
      .orderBy(desc(subscriptions.createdAt))
      .get());

  if (status === "ACTIVE") {
    if (row) {
      await updateSubscriptionStatus(db, row.id, "active", {
        shopifyChargeId: chargeId ?? row.shopifyChargeId,
        currentPeriodEndsAt: new Date(Date.now() + 30 * 86_400_000),
      });
    }
    await db
      .update(shops)
      .set({ planHandle: "premium", updatedAt: new Date() })
      .where(eq(shops.id, shopId));
    return;
  }

  // Terminal / downgrade states.
  if (
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    status === "DECLINED" ||
    status === "FROZEN"
  ) {
    if (row) {
      await updateSubscriptionStatus(db, row.id, internal, {
        shopifyChargeId: chargeId ?? row.shopifyChargeId,
        cancelledAt: internal === "cancelled" ? new Date() : row.cancelledAt,
      });
    }
    await db
      .update(shops)
      .set({ planHandle: "free", updatedAt: new Date() })
      .where(eq(shops.id, shopId));
    return;
  }

  // PENDING / ACCEPTED / anything else: record the status, keep the plan.
  if (row && chargeId && row.shopifyChargeId !== chargeId) {
    await updateSubscriptionStatus(db, row.id, internal, { shopifyChargeId: chargeId });
  }
}

/**
 * The shop's effective plan handle. Reads `shop.planHandle`, defaulting to
 * "free" for unknown shops. Server-side gating must always resolve through
 * this (never trust the client).
 */
export async function getActivePlanHandle(
  db: Database,
  shopId: string,
): Promise<PlanHandle> {
  const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
  const handle = shop?.planHandle ?? "free";
  return handle === PLAN_PREMIUM.handle ? "premium" : "free";
}

/**
 * Downgrade to free (used when the merchant chooses the free plan in the UI).
 *
 * `shopifyCancel` is an optional adapter that performs the REAL Shopify
 * subscription cancellation (via `auth.billing.cancel(...)`). It is injected
 * by the caller (the route) so this function stays unit-testable without a
 * live Shopify session. Contract:
 *   - When there IS an active Shopify subscription, the adapter cancels it.
 *     If that call fails, the adapter should throw — we deliberately do NOT
 *     swallow that error, so the merchant isn't told they've downgraded while
 *     Shopify keeps billing them.
 *   - When there is NOTHING to cancel on Shopify's side (e.g. the local row
 *     is already non-active, or no charge id was ever recorded), the adapter
 *     is expected to no-op rather than throw — that's a legitimate case
 *     (already cancelled, trial never converted, etc.), not a failure.
 *
 * Only after the Shopify-side cancel (if any) succeeds do we flip local
 * state: mark the active subscription row cancelled and set
 * `shop.planHandle = "free"`.
 */
export async function cancelSubscription(
  db: Database,
  shopId: string,
  shopifyCancel?: () => Promise<void>,
): Promise<void> {
  if (shopifyCancel) {
    await shopifyCancel();
  }

  const active = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.shopId, shopId))
    .orderBy(desc(subscriptions.createdAt))
    .get();
  if (active && active.status === "active") {
    await updateSubscriptionStatus(db, active.id, "cancelled", {
      cancelledAt: new Date(),
    });
  }
  await db
    .update(shops)
    .set({ planHandle: "free", updatedAt: new Date() })
    .where(eq(shops.id, shopId));
}
