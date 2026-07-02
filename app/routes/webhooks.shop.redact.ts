import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { getDb } from "../lib/db/client.server";
import { purgeShopData } from "../services/gdpr.service.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  const shopify = getShopify(env);

  let topic: string;
  let shop: string;
  try {
    ({ topic, shop } = await shopify.authenticate.webhook(request));
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  if (topic !== "SHOP_REDACT") {
    return new Response("Ignored", { status: 200 });
  }

  const db = getDb(env.DB);
  // Shopify sends this 48h after uninstall. The shop row may already be
  // marked uninstalled by the app/uninstalled webhook — purge regardless.
  // Pass the UPLOADS R2 binding so purgeShopData also deletes the shop's
  // raw uploaded CSV/XLSX files, not just the DB rows referencing them.
  await purgeShopData(db, shop, env.UPLOADS);

  return new Response(null, { status: 200 });
}
