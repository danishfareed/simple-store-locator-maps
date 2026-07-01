import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedShop } from "../helpers/db";
import { shops, subscriptions } from "../../app/lib/db/schema";
import {
  syncSubscriptionFromShopify,
  getActivePlanHandle,
  cancelSubscription,
} from "../../app/services/billing.service.server";
import { newId } from "../../app/lib/utils/slug";

const CHARGE_ID = "gid://shopify/AppSubscription/1029266948";

/** Seed a shop with a pending premium subscription carrying the real charge id. */
async function seedPending(shopId: string) {
  const db = await makeTestDb();
  await seedShop(db, shopId);
  await db.insert(subscriptions).values({
    id: newId(),
    shopId,
    planHandle: "premium",
    shopifyChargeId: CHARGE_ID,
    status: "pending",
    confirmationUrl: "https://example.com/confirm",
  });
  return db;
}

/** Build an app_subscriptions/update-shaped payload. */
function payload(status: string, chargeId = CHARGE_ID) {
  return {
    app_subscription: {
      admin_graphql_api_id: chargeId,
      name: "Premium",
      status,
      plan_handle: "premium",
    },
  };
}

describe("syncSubscriptionFromShopify", () => {
  it("ACTIVE → shop plan premium + subscription active", async () => {
    const shopId = "sync-active";
    const db = await seedPending(shopId);

    await syncSubscriptionFromShopify(db, shopId, payload("ACTIVE"));

    const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
    expect(shop?.planHandle).toBe("premium");

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.shopifyChargeId, CHARGE_ID))
      .get();
    expect(sub?.status).toBe("active");

    expect(await getActivePlanHandle(db, shopId)).toBe("premium");
  });

  it("CANCELLED → downgrade shop plan to free + subscription cancelled", async () => {
    const shopId = "sync-cancelled";
    const db = await seedPending(shopId);
    // Simulate a previously-active premium shop.
    await db.update(shops).set({ planHandle: "premium" }).where(eq(shops.id, shopId));

    await syncSubscriptionFromShopify(db, shopId, payload("CANCELLED"));

    const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
    expect(shop?.planHandle).toBe("free");

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.shopifyChargeId, CHARGE_ID))
      .get();
    expect(sub?.status).toBe("cancelled");

    expect(await getActivePlanHandle(db, shopId)).toBe("free");
  });

  it.each(["EXPIRED", "DECLINED", "FROZEN"])(
    "%s → downgrade shop plan to free",
    async (status) => {
      const shopId = `sync-${status.toLowerCase()}`;
      const db = await seedPending(shopId);
      await db.update(shops).set({ planHandle: "premium" }).where(eq(shops.id, shopId));

      await syncSubscriptionFromShopify(db, shopId, payload(status));

      const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
      expect(shop?.planHandle).toBe("free");
      expect(await getActivePlanHandle(db, shopId)).toBe("free");
    },
  );

  it("stores the real charge id from admin_graphql_api_id on activation", async () => {
    const shopId = "sync-chargeid";
    const db = await seedPending(shopId);

    await syncSubscriptionFromShopify(db, shopId, payload("ACTIVE"));

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.shopId, shopId))
      .get();
    expect(sub?.shopifyChargeId).toBe(CHARGE_ID);
    expect(sub?.status).toBe("active");
  });

  it("is a no-op-safe when no matching subscription row exists (still flips plan)", async () => {
    const shopId = "sync-nosub";
    const db = await makeTestDb();
    await seedShop(db, shopId);

    await syncSubscriptionFromShopify(db, shopId, payload("ACTIVE", "gid://other"));

    const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
    expect(shop?.planHandle).toBe("premium");
  });
});

describe("getActivePlanHandle", () => {
  it("defaults to free for an unknown shop", async () => {
    const db = await makeTestDb();
    expect(await getActivePlanHandle(db, "ghost")).toBe("free");
  });
});

describe("cancelSubscription", () => {
  /** Seed a shop with an ACTIVE premium subscription row. */
  async function seedActive(shopId: string) {
    const db = await makeTestDb();
    await seedShop(db, shopId);
    await db.update(shops).set({ planHandle: "premium" }).where(eq(shops.id, shopId));
    await db.insert(subscriptions).values({
      id: newId(),
      shopId,
      planHandle: "premium",
      shopifyChargeId: CHARGE_ID,
      status: "active",
      currentPeriodEndsAt: new Date(Date.now() + 30 * 86_400_000),
    });
    return db;
  }

  it("invokes the injected shopifyCancel adapter and downgrades local state", async () => {
    const shopId = "cancel-with-adapter";
    const db = await seedActive(shopId);
    const shopifyCancel = vi.fn().mockResolvedValue(undefined);

    await cancelSubscription(db, shopId, shopifyCancel);

    expect(shopifyCancel).toHaveBeenCalledTimes(1);

    const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
    expect(shop?.planHandle).toBe("free");

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.shopId, shopId))
      .get();
    expect(sub?.status).toBe("cancelled");
    expect(sub?.cancelledAt).toBeTruthy();
  });

  it("still downgrades local DB state to free without an adapter", async () => {
    const shopId = "cancel-no-adapter";
    const db = await seedActive(shopId);

    await cancelSubscription(db, shopId);

    const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
    expect(shop?.planHandle).toBe("free");

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.shopId, shopId))
      .get();
    expect(sub?.status).toBe("cancelled");
  });

  it("no active Shopify subscription: adapter no-ops without throwing, local state still ends free", async () => {
    const shopId = "cancel-nothing-active";
    const db = await makeTestDb();
    await seedShop(db, shopId); // shop starts on "free", no subscription rows at all

    // Adapter simulating "nothing to cancel on Shopify's side" — resolves cleanly.
    const shopifyCancel = vi.fn().mockResolvedValue(undefined);

    await expect(cancelSubscription(db, shopId, shopifyCancel)).resolves.toBeUndefined();

    expect(shopifyCancel).toHaveBeenCalledTimes(1);

    const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
    expect(shop?.planHandle).toBe("free");
  });

  it("propagates a genuine Shopify cancel failure instead of silently downgrading", async () => {
    const shopId = "cancel-adapter-fails";
    const db = await seedActive(shopId);
    const shopifyCancel = vi.fn().mockRejectedValue(new Error("Shopify API error"));

    await expect(cancelSubscription(db, shopId, shopifyCancel)).rejects.toThrow(
      "Shopify API error",
    );

    // Local state must NOT have been downgraded — the merchant is still on
    // premium locally since we couldn't confirm the Shopify-side cancel.
    const shop = await db.select().from(shops).where(eq(shops.id, shopId)).get();
    expect(shop?.planHandle).toBe("premium");

    const sub = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.shopId, shopId))
      .get();
    expect(sub?.status).toBe("active");
  });
});
