import { eq } from "drizzle-orm";
import type { Database } from "../lib/db/client.server";
import { shops, type ShopSettings } from "../lib/db/schema";
import { SettingsSchema, type SettingsInput } from "../schemas/settings.schema";
import { planAllowsProvider } from "../lib/billing/plans";

/** Read a shop's settings. Returns `{}` if the shop has never saved any. */
export async function getSettings(db: Database, shopId: string): Promise<ShopSettings> {
  const shop = await db.select({ settings: shops.settings }).from(shops).where(eq(shops.id, shopId)).get();
  return shop?.settings ?? {};
}

/**
 * Validate `input` against `SettingsSchema`, merge it into the shop's
 * existing settings, and persist the merge to `shops.settings`. Merging
 * (rather than replacing) means a partial save — e.g. from a form that only
 * renders a subset of fields — never clobbers settings it didn't touch.
 *
 * Google Maps is premium-gated the same way widget provider/type already are
 * (`planAllowsProvider`, `assertWidgetTypeAllowed`): a free-plan shop that
 * somehow submits `mapProvider: "google"` (bypassed/stale client UI, a
 * downgrade after saving) is silently clamped back to `leaflet` here, so the
 * DB never holds a provider choice the shop's current plan doesn't allow.
 */
export async function saveSettings(
  db: Database,
  shopId: string,
  input: SettingsInput,
): Promise<ShopSettings> {
  const parsed = SettingsSchema.parse(input);
  const shop = await db
    .select({ settings: shops.settings, planHandle: shops.planHandle })
    .from(shops)
    .where(eq(shops.id, shopId))
    .get();
  const current = shop?.settings ?? {};

  if (parsed.mapProvider === "google" && !planAllowsProvider(shop?.planHandle ?? "free", "google")) {
    parsed.mapProvider = "leaflet";
  }

  const merged: ShopSettings = {
    ...current,
    ...parsed,
    branding:
      parsed.branding || current.branding
        ? { ...current.branding, ...parsed.branding }
        : undefined,
  };

  await db
    .update(shops)
    .set({ settings: merged, updatedAt: new Date() })
    .where(eq(shops.id, shopId));

  return merged;
}
