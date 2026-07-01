import {
  LEAFLET_OSM,
  PROVIDERS,
  type MapProviderSpec,
  type ProviderId,
} from "../features/providers/providers";

export type { ProviderId, MapProviderSpec } from "../features/providers/providers";
export { PROVIDERS } from "../features/providers/providers";

/**
 * Server-side resolution of the effective provider for a given shop. Falls
 * back to Leaflet when the merchant has selected a provider that requires an
 * API key but hasn't supplied one.
 */
export function resolveProvider(
  requested: ProviderId,
  ctx: { hasApiKey: boolean },
): MapProviderSpec {
  const p = PROVIDERS[requested];
  if (p.requiresApiKey && !ctx.hasApiKey) return LEAFLET_OSM;
  return p;
}
