import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { getDb } from "../lib/db/client.server";
import { redactCustomer } from "../services/gdpr.service.server";

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

  if (topic !== "CUSTOMERS_REDACT") {
    return new Response("Ignored", { status: 200 });
  }

  const db = getDb(env.DB);
  const customerId = String(
    (payload as { customer?: { id?: string | number } })?.customer?.id ?? "",
  );

  await redactCustomer(db, shop, customerId);

  return new Response(null, { status: 200 });
}
