import type { ActionFunctionArgs } from "react-router";
import { eq } from "drizzle-orm";
import { getShopify } from "../shopify.server";
import { getDb } from "../lib/db/client.server";
import { sessions, shops } from "../lib/db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const shopify = getShopify(env);
  const { topic, shop } = await shopify.authenticate.webhook(request);

  if (topic !== "APP_UNINSTALLED") {
    return new Response("Ignored", { status: 200 });
  }

  const db = getDb(env.DB);
  // Keep the shop row for historical analytics but mark it uninstalled and
  // clear sessions so OAuth tokens can't be reused.
  await db
    .update(shops)
    .set({ uninstalledAt: new Date(), updatedAt: new Date() })
    .where(eq(shops.id, shop));
  await db.delete(sessions).where(eq(sessions.shop, shop));

  return new Response(null, { status: 200 });
}
