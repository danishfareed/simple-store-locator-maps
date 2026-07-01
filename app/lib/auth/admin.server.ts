import type { AppLoadContext } from "react-router";
import { eq } from "drizzle-orm";
import { getShopify } from "../../shopify.server";
import { getDb } from "../db/client.server";
import { shops } from "../db/schema";

/**
 * Gatekeeper for embedded-admin routes.
 *
 * Authenticates the merchant, then ensures a corresponding row exists in
 * `shops` (self-healing — first hit after install inserts it). Returns the
 * authenticated shop record plus the admin API client.
 */
export async function requireAdmin(request: Request, context: AppLoadContext) {
  const env = context.cloudflare.env;
  const shopify = getShopify(env);
  const auth = await shopify.authenticate.admin(request);

  const db = getDb(env.DB);
  const shopDomain = auth.session.shop;

  const existing = await db.select().from(shops).where(eq(shops.id, shopDomain)).get();

  if (!existing) {
    await db
      .insert(shops)
      .values({
        id: shopDomain,
        shopDomain,
        planHandle: "free",
        installedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  const shop =
    existing ?? (await db.select().from(shops).where(eq(shops.id, shopDomain)).get())!;

  return { shopify, auth, shop, db, env };
}

export type AdminContext = Awaited<ReturnType<typeof requireAdmin>>;
