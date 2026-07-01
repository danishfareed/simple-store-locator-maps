import {
  LEAFLET_OSM,
  PROVIDERS,
  type MapProviderSpec,
  type ProviderId,
} from "../features/providers/providers";
import { planAllowsProvider } from "../lib/billing/plans";

export type { ProviderId, MapProviderSpec } from "../features/providers/providers";
export { PROVIDERS } from "../features/providers/providers";

/**
 * Server-side resolution of the effective provider for a given shop.
 *
 * Two independent constraints, both enforced here (never on the client):
 *  1. PLAN: free plans are OSM/Leaflet only — a `google` selection is forced
 *     to Leaflet regardless of any stored API key. Premium may use Google.
 *  2. API KEY: even when the plan allows it, a provider that requires a key
 *     but has none falls back to Leaflet.
 *
 * `planHandle` is optional for backward compatibility; when omitted, only the
 * API-key constraint applies (used by call sites that pre-gate the plan).
 */
export function resolveProvider(
  requested: ProviderId,
  ctx: { hasApiKey: boolean; planHandle?: string },
): MapProviderSpec {
  if (ctx.planHandle !== undefined && !planAllowsProvider(ctx.planHandle, requested)) {
    return LEAFLET_OSM;
  }
  const p = PROVIDERS[requested];
  if (p.requiresApiKey && !ctx.hasApiKey) return LEAFLET_OSM;
  return p;
}
