import { redirect, type LoaderFunctionArgs } from "react-router";

/**
 * Root landing. Shopify loads the embedded app at the app URL root
 * (`/?embedded=1&shop=…&host=…&id_token=…`); forward to `/app` while preserving
 * every query param so the embedded auth handshake continues uninterrupted.
 */
export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return redirect(`/app${url.search}`);
}
