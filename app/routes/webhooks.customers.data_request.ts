import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { getDb } from "../lib/db/client.server";
import { customerDataReport } from "../services/gdpr.service.server";

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

  if (topic !== "CUSTOMERS_DATA_REQUEST") {
    return new Response("Ignored", { status: 200 });
  }

  const db = getDb(env.DB);
  const customerId = String(
    (payload as { customer?: { id?: string | number } })?.customer?.id ?? "",
  );

  // Shopify expects a 200 acknowledging receipt; the actual data export is
  // typically delivered out-of-band to the merchant. We log the report here
  // since the app holds no customer PII to package into a downloadable file.
  await customerDataReport(db, shop, customerId);

  return new Response(null, { status: 200 });
}
