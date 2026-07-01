import type { Plan } from "../db/schema";

export interface BillingPlanConfig {
  amount: number;
  currencyCode: string;
  interval: "ANNUAL" | "EVERY_30_DAYS";
  trialDays: number;
}

/**
 * Build the billing config the Shopify package expects from our D1 plans list.
 * The package handles charge creation, confirmation, and webhook state — we
 * keep the D1 row in sync in a webhook handler.
 */
export function toBillingConfig(plans: Plan[]): Record<string, BillingPlanConfig> {
  const config: Record<string, BillingPlanConfig> = {};
  for (const p of plans) {
    if (p.priceCents === 0) continue;
    config[p.handle] = {
      amount: p.priceCents / 100,
      currencyCode: p.currency,
      interval: p.interval === "annual" ? "ANNUAL" : "EVERY_30_DAYS",
      trialDays: p.trialDays,
    };
  }
  return config;
}
