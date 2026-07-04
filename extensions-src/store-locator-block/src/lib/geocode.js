// Forward geocoding (address / place text -> lat,lng). One request per call;
// the caller is responsible for debouncing and a sensible minimum query length.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * @typedef {Object} GeocodeOptions
 * @property {"leaflet"|"google"|string} [provider]  Map provider id.
 * @property {string} [apiKey]        Google Maps/Geocoding API key.
 * @property {string} [osmGeocoderUrl] Override for the OSM/Nominatim endpoint.
 */

/**
 * Resolve a free-text query to a single `{lat, lng}` coordinate, or `null` when
 * nothing matches / the request fails. Never throws.
 *
 * Uses the Google Geocoding API when `provider === "google"` and an `apiKey` is
 * supplied; otherwise falls back to Nominatim (OSM), honouring `osmGeocoderUrl`.
 *
 * @param {string} query
 * @param {GeocodeOptions} [options]
 * @returns {Promise<{lat:number, lng:number} | null>}
 */
export async function geocode(query, options = {}) {
  const q = String(query || "").trim();
  if (!q) return null;

  const { provider, apiKey, osmGeocoderUrl } = options;

  try {
    if (provider === "google" && apiKey) {
      return await geocodeGoogle(q, apiKey);
    }
    return await geocodeNominatim(q, osmGeocoderUrl);
  } catch {
    return null;
  }
}

async function geocodeGoogle(q, apiKey) {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(q)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const loc = data?.results?.[0]?.geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    return null;
  }
  return { lat: loc.lat, lng: loc.lng };
}

async function geocodeNominatim(q, osmGeocoderUrl) {
  const base = osmGeocoderUrl || NOMINATIM_URL;
  const sep = base.includes("?") ? "&" : "?";
  const url = `${base}${sep}format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const hits = await res.json();
  const hit = Array.isArray(hits) ? hits[0] : null;
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon ?? hit.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
