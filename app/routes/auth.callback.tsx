import type { LoaderFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";

// OAuth callback — the Shopify package handles token exchange + redirect.
export async function loader({ request, context }: LoaderFunctionArgs) {
  const shopify = getShopify(context.cloudflare.env);
  await shopify.authenticate.admin(request);
  return null;
}

export default function Callback() {
  return null;
}
