import type { Plan, WidgetConfig, WidgetType } from "../db/schema";
import type { ProviderId } from "../../features/providers/providers";
import {
  BillingInterval,
  type BillingConfig,
} from "@shopify/shopify-api";

/*
 * Two-plan model — the single source of truth for plan caps & feature flags on
 * the SERVER. These constants MUST mirror the `plans` rows written by
 * `drizzle/migrations/0003_reprice_plans.sql`; the migration is authoritative
 * for the DB, and these constants are authoritative for static config that has
 * no DB access (e.g. the Shopify billing config, gating helpers).
 *
 * Legacy tiers (starter/pro/unlimited) are deactivated in the DB, not deleted,
 * so they intentionally do NOT appear here.
 */

export type PlanHandle = "free" | "premium";

/** Premium monthly price in cents ($14.99/mo). */
export const PREMIUM_MONTHLY_CENTS = 1499;
/** Optional annual price in cents ($149.90/yr) — an interval on the SAME plan. */
export const PREMIUM_ANNUAL_CENTS = 14990;
/** Days of free trial on premium. */
export const PREMIUM_TRIAL_DAYS = 7;

export const PLAN_FREE: Plan = {
  handle: "free",
  name: "Free",
  priceCents: 0,
  currency: "USD",
  interval: "every_30_days",
  trialDays: 0,
  maxLocations: 3,
  maxImportsPerMonth: 1,
  maxStorefrontRequestsPerDay: 20000,
  features: [
    "osm",
    "map_list_widget",
    "csv_import",
    "basic_analytics",
  ],
  sortOrder: 1,
  isActive: true,
};

export const PLAN_PREMIUM: Plan = {
  handle: "premium",
  name: "Premium",
  priceCents: PREMIUM_MONTHLY_CENTS,
  currency: "USD",
  interval: "every_30_days",
  trialDays: PREMIUM_TRIAL_DAYS,
  maxLocations: 100,
  maxImportsPerMonth: 1000,
  maxStorefrontRequestsPerDay: 500000,
  features: [
    "osm",
    "google_maps",
    "all_widgets",
    "csv_import",
    "xlsx_import",
    "full_analytics",
    "custom_theme",
    "clustering",
    "filters",
    "near_me",
    "remove_branding",
  ],
  sortOrder: 2,
  isActive: true,
};

/** The two ACTIVE plans, in display order. */
export const PLANS: Plan[] = [PLAN_FREE, PLAN_PREMIUM];

const BY_HANDLE: Record<PlanHandle, Plan> = {
  free: PLAN_FREE,
  premium: PLAN_PREMIUM,
};

/** Resolve a handle to a plan constant, defaulting to free for anything unknown. */
export function getPlanConfig(handle: string): Plan {
  return BY_HANDLE[handle as PlanHandle] ?? PLAN_FREE;
}

/** The feature-flag list for a plan handle. */
export function planFeatures(handle: string): string[] {
  return getPlanConfig(handle).features ?? [];
}

/** Whether a plan carries a given feature flag. */
export function planAllows(handle: string, feature: string): boolean {
  return planFeatures(handle).includes(feature);
}

/** Location cap for a plan (free = 3). */
export function planMaxLocations(handle: string): number {
  return getPlanConfig(handle).maxLocations;
}

/**
 * Whether a plan may use a given widget type. Free is restricted to `map_list`;
 * premium unlocks every type (`all_widgets`).
 */
export function planAllowsWidgetType(handle: string, type: WidgetType): boolean {
  if (planAllows(handle, "all_widgets")) return true;
  return type === "map_list";
}

/**
 * Whether a plan may use a given map provider. Free is OSM/leaflet only;
 * premium adds Google (`google_maps`).
 */
export function planAllowsProvider(handle: string, provider: ProviderId): boolean {
  if (provider === "leaflet") return true;
  if (provider === "google") return planAllows(handle, "google_maps");
  return false;
}

/** Whether a plan may run a given import kind. Free is CSV-only. */
export function planAllowsImportKind(handle: string, kind: "csv" | "xlsx"): boolean {
  if (kind === "csv") return true;
  return planAllows(handle, "xlsx_import");
}

/**
 * Whether the storefront should show the "Powered by" branding. Shown on free,
 * hidden on plans that carry `remove_branding` (premium).
 */
export function planShowsPoweredBy(handle: string): boolean {
  return !planAllows(handle, "remove_branding");
}

/**
 * Server-side gate for premium WIDGET CONFIG features (theme, clustering,
 * near-me, categories/filters). Returns a shallow-cloned config with any
 * feature the plan does not allow stripped out; everything else (provider,
 * type, powered-by — handled elsewhere — plus base fields like
 * defaultCenter/defaultZoom and per-type extras) passes through untouched.
 *
 * Pure and client-safe (no server-only imports) so it can run at BOTH save
 * time (`saveWidget`, to keep the DB honest) and render time
 * (`proxy.widget.ts`, the authoritative gate — it also covers widgets saved
 * before a downgrade). Do not use this to gate widget TYPE or PROVIDER;
 * those already have their own enforcement (`assertWidgetTypeAllowed`,
 * `resolveProvider`).
 */
export function applyPlanToConfig(config: WidgetConfig, planHandle: string): WidgetConfig {
  const next: WidgetConfig = { ...config };

  if (!planAllows(planHandle, "custom_theme")) {
    delete next.theme;
  }
  if (!planAllows(planHandle, "clustering")) {
    next.clustering = false;
  }
  if (!planAllows(planHandle, "near_me")) {
    next.enableNearMe = false;
  }
  if (!planAllows(planHandle, "filters")) {
    delete next.categories;
    delete next.filters;
  }

  return next;
}

/** Map our stored interval string to the Shopify `BillingInterval` enum. */
export function toBillingInterval(
  interval: string,
): BillingInterval.Every30Days | BillingInterval.Annual {
  return interval === "annual"
    ? BillingInterval.Annual
    : BillingInterval.Every30Days;
}

/*
 * ──────────────── Shopify billing config ────────────────
 *
 * The Shopify billing config is indexed by an app-specific "billing key". We
 * expose the SAME premium tier under two keys so the merchant can pick a
 * cadence at checkout without introducing a third DB plan:
 *   - `premium`         → monthly ($14.99, EVERY_30_DAYS)
 *   - `premium_annual`  → annual  ($149.90, ANNUAL)
 * Both grant `shop.planHandle = "premium"` when active.
 *
 * NOTE: `@shopify/shopify-app-react-router` uses the line-item billing shape:
 *   { trialDays?, lineItems: [{ amount, currencyCode, interval }] }
 * (verified against the installed package types — NOT the flat legacy shape).
 */

export const BILLING_KEY_PREMIUM_MONTHLY = "premium";
export const BILLING_KEY_PREMIUM_ANNUAL = "premium_annual";

/** Billing key → the DB plan handle it grants. */
export function billingKeyToPlanHandle(key: string): PlanHandle {
  return key === BILLING_KEY_PREMIUM_ANNUAL || key === BILLING_KEY_PREMIUM_MONTHLY
    ? "premium"
    : "free";
}

/** Static billing config for `shopifyApp({ billing })`. Built from constants. */
export const BILLING_CONFIG: BillingConfig = {
  [BILLING_KEY_PREMIUM_MONTHLY]: {
    trialDays: PREMIUM_TRIAL_DAYS,
    lineItems: [
      {
        amount: PREMIUM_MONTHLY_CENTS / 100,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
    ],
  },
  [BILLING_KEY_PREMIUM_ANNUAL]: {
    trialDays: PREMIUM_TRIAL_DAYS,
    lineItems: [
      {
        amount: PREMIUM_ANNUAL_CENTS / 100,
        currencyCode: "USD",
        interval: BillingInterval.Annual,
      },
    ],
  },
};
