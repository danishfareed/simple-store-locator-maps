import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import type { CloudflareEnv } from "../workers/app";
import { D1SessionStorage } from "./lib/shopify/session-storage.server";
import { BILLING_CONFIG } from "./lib/billing/plans";

type AppInstance = ReturnType<typeof shopifyApp>;

/**
 * Per-env factory. A Shopify app is cheap to construct, and its only heavy
 * dependency (session storage) is a thin D1 wrapper — so we memoize by D1
 * binding identity to avoid re-initialising on every request in a single Worker
 * isolate while still staying request-scoped for binding correctness.
 */
const cache = new WeakMap<D1Database, AppInstance>();

export function getShopify(env: CloudflareEnv): AppInstance {
  const cached = cache.get(env.DB);
  if (cached) return cached;

  const app = shopifyApp({
    apiKey: env.SHOPIFY_API_KEY,
    apiSecretKey: env.SHOPIFY_API_SECRET,
    apiVersion: (env.SHOPIFY_API_VERSION as ApiVersion) ?? ApiVersion.April26,
    scopes: env.SCOPES?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
    appUrl: env.SHOPIFY_APP_URL,
    authPathPrefix: "/auth",
    sessionStorage: new D1SessionStorage(env.DB),
    distribution: AppDistribution.AppStore,
    isEmbeddedApp: true,
    // Static billing config (two keys → the same premium tier: monthly &
    // annual). Charge creation/confirmation is handled by the package via
    // `auth.billing.request`; we keep the D1 subscription/shop rows in sync in
    // the `app_subscriptions/update` webhook. See app/lib/billing/plans.ts.
    billing: BILLING_CONFIG,
  });

  cache.set(env.DB, app);
  return app;
}

export { ApiVersion };
