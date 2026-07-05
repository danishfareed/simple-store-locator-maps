import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  // Shopify loads the app at the app URL root; send it to /app, preserving the
  // embedded query params (shop, host, embedded, id_token, …).
  index("routes/_index.tsx"),

  // Embedded admin shell under /app
  route("app", "routes/app.tsx", [
    index("routes/app._index.tsx"),
    route("locations", "routes/app.locations.tsx"),
    route("locations/new", "routes/app.locations.new.tsx"),
    route("locations/:id", "routes/app.locations.$id.tsx"),
    route("imports", "routes/app.imports.tsx"),
    route("widgets", "routes/app.widgets.tsx"),
    route("widgets/new", "routes/app.widgets.new.tsx"),
    route("widgets/:id", "routes/app.widgets.$id.tsx"),
    route("analytics", "routes/app.analytics.tsx"),
    route("settings", "routes/app.settings.tsx"),
    route("billing", "routes/app.billing.tsx"),
  ]),

  // Live widget preview — standalone HTML doc for the editor iframe.
  // NOT under the /app layout: no admin auth, no data (all config arrives via
  // same-origin postMessage from the authenticated parent editor).
  route("widget-preview", "routes/widget-preview.tsx"),

  // Auth
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/*", "routes/auth.$.tsx"),

  // App proxy — storefront-facing JSON
  route("proxy/locations", "routes/proxy.locations.ts"),
  route("proxy/search", "routes/proxy.search.ts"),
  route("proxy/widget", "routes/proxy.widget.ts"),
  route("proxy/event", "routes/proxy.event.ts"),

  // Webhooks
  route("webhooks/app/uninstalled", "routes/webhooks.app.uninstalled.ts"),
  route(
    "webhooks/app_subscriptions/update",
    "routes/webhooks.app_subscriptions.update.ts",
  ),
  route(
    "webhooks/customers/data_request",
    "routes/webhooks.customers.data_request.ts",
  ),
  route("webhooks/customers/redact", "routes/webhooks.customers.redact.ts"),
  route("webhooks/shop/redact", "routes/webhooks.shop.redact.ts"),
] satisfies RouteConfig;
