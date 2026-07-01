import { eq } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import {
  analyticsEvents,
  auditLog,
  imports,
  locations,
  quotaUsage,
  sessions,
  shops,
  subscriptions,
  widgets,
} from "../lib/db/schema";

/**
 * GDPR "shop/redact" support: permanently deletes every row associated with
 * `shopId` (the myshopify domain). Deletes children before parents in
 * FK-safe order — the schema's ON DELETE CASCADE covers this too, but we
 * delete explicitly so purge behaviour doesn't silently depend on cascade
 * wiring staying correct as the schema evolves.
 */
export async function purgeShopData(db: Database, shopId: string): Promise<void> {
  await db.delete(analyticsEvents).where(eq(analyticsEvents.shopId, shopId));
  await db.delete(quotaUsage).where(eq(quotaUsage.shopId, shopId));
  await db.delete(imports).where(eq(imports.shopId, shopId));
  await db.delete(widgets).where(eq(widgets.shopId, shopId));
  await db.delete(locations).where(eq(locations.shopId, shopId));
  await db.delete(subscriptions).where(eq(subscriptions.shopId, shopId));
  // sessions.shop holds the same myshopify domain as shops.id.
  await db.delete(sessions).where(eq(sessions.shop, shopId));
  await db.delete(auditLog).where(eq(auditLog.shopId, shopId));
  await db.delete(shops).where(eq(shops.id, shopId));
}

/**
 * GDPR "customers/data_request" support: the app never stores customer PII
 * (names, emails, addresses) tied to a specific customer — storefront
 * analytics only retain a hashed IP address. Report that fact back so the
 * merchant can relay it to the customer.
 */
export async function customerDataReport(
  _db: Database,
  _shopId: string,
  _customerId: string,
): Promise<{ heldData: string[] }> {
  return {
    heldData: ["No customer PII stored; storefront analytics use hashed IPs only."],
  };
}

/**
 * GDPR "customers/redact" support: no rows are currently keyed by customer
 * ID, so this is a no-op purge. Present for compliance and forward
 * compatibility — if customer-linked analytics rows are ever added, delete
 * them here.
 */
export async function redactCustomer(
  _db: Database,
  _shopId: string,
  _customerId: string,
): Promise<void> {
  // No customer-keyed rows exist yet; nothing to delete.
}
