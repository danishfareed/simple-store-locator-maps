import type { AppLoadContext } from "react-router";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { shops } from "../db/schema";
import { verifyAppProxy } from "../shopify/hmac.server";

/**
 * Gatekeeper for storefront-facing app-proxy routes.
 *
 * NEVER trust proxy requests without HMAC verification — Shopify signs every
 * app-proxy request, and the signature must validate with the app's API
 * secret. We also never read plan/quota data from the storefront request; all
 * enforcement runs server-side against the shop row.
 */
export async function requireStorefront(
  request: Request,
  context: AppLoadContext,
) {
  const env = context.cloudflare.env;
  const url = await verifyAppProxy(request, env.SHOPIFY_API_SECRET);
  if (!url) {
    return { ok: false as const, response: new Response("Invalid signature", { status: 401 }) };
  }

  const shopDomain = url.searchParams.get("shop");
  if (!shopDomain) {
    return { ok: false as const, response: new Response("Missing shop", { status: 400 }) };
  }

  const db = getDb(env.DB);
  const shop = await db.select().from(shops).where(eq(shops.id, shopDomain)).get();
  if (!shop || shop.uninstalledAt) {
    return { ok: false as const, response: new Response("Not installed", { status: 404 }) };
  }

  return { ok: true as const, url, shop, db, env };
}

export type StorefrontContext = Extract<
  Awaited<ReturnType<typeof requireStorefront>>,
  { ok: true }
>;
