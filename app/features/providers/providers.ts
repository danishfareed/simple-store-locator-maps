/**
 * Client-safe map-provider registry. Contains only data (no runtime logic that
 * depends on server bindings), so both admin UI components and server routes
 * can import from here. Actual resolution logic that reads shop settings lives
 * in `app/services/provider.service.server.ts`.
 */

export type ProviderId = "leaflet" | "google";

export interface MapProviderSpec {
  id: ProviderId;
  displayName: string;
  supportsClustering: boolean;
  tileUrl?: string;
  attribution: string;
  requiresApiKey: boolean;
}

export const LEAFLET_OSM: MapProviderSpec = {
  id: "leaflet",
  displayName: "Leaflet + OpenStreetMap",
  supportsClustering: true,
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  requiresApiKey: false,
};

export const GOOGLE_MAPS: MapProviderSpec = {
  id: "google",
  displayName: "Google Maps",
  supportsClustering: true,
  attribution: "",
  requiresApiKey: true,
};

export const PROVIDERS: Record<ProviderId, MapProviderSpec> = {
  leaflet: LEAFLET_OSM,
  google: GOOGLE_MAPS,
};
