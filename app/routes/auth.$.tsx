import type { LoaderFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";

// Catch-all for /auth/* — forwards to the Shopify package's auth strategy.
export async function loader({ request, context }: LoaderFunctionArgs) {
  const shopify = getShopify(context.cloudflare.env);
  await shopify.authenticate.admin(request);
  // authenticate.admin throws a redirect response on unauthenticated flows.
  return null;
}

export default function AuthCatchAll() {
  return null;
}
