import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { getDb } from "../lib/db/client.server";
import { syncSubscriptionFromShopify } from "../services/billing.service.server";

/**
 * `app_subscriptions/update` webhook — Shopify's authoritative signal for
 * subscription state changes (activation, cancellation, expiry, freeze, …).
 * We verify HMAC via `authenticate.webhook`, then reconcile our D1 state.
 * This is the ONLY place plan activation happens — never a client round-trip.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const shopify = getShopify(env);

  let topic: string;
  let shop: string;
  let payload: unknown;
  try {
    ({ topic, shop, payload } = await shopify.authenticate.webhook(request));
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  if (topic !== "APP_SUBSCRIPTIONS_UPDATE") {
    return new Response("Ignored", { status: 200 });
  }

  const db = getDb(env.DB);
  await syncSubscriptionFromShopify(db, shop, payload);

  return new Response(null, { status: 200 });
}
