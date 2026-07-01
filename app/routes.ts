import { type RouteConfig, route, index, layout } from "@react-router/dev/routes";

export default [
  // Embedded admin shell under /app
  layout("routes/app.tsx", [
    index("routes/app._index.tsx"),
    route("locations", "routes/app.locations.tsx"),
    route("locations/new", "routes/app.locations.new.tsx"),
    route("locations/:id", "routes/app.locations.$id.tsx"),
    route("imports", "routes/app.imports.tsx"),
    route("widgets", "routes/app.widgets.tsx"),
    route("analytics", "routes/app.analytics.tsx"),
    route("settings", "routes/app.settings.tsx"),
    route("billing", "routes/app.billing.tsx"),
  ]),

  // Auth
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/*", "routes/auth.$.tsx"),

  // App proxy — storefront-facing JSON
  route("proxy/locations", "routes/proxy.locations.ts"),
  route("proxy/search", "routes/proxy.search.ts"),
  route("proxy/widget", "routes/proxy.widget.ts"),

  // Webhooks
  route("webhooks/app/uninstalled", "routes/webhooks.app.uninstalled.ts"),
] satisfies RouteConfig;
