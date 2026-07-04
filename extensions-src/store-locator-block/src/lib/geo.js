// Pure geo helpers for the storefront widget. No DOM, no network.

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometres between two `{lat, lng}` points.
 * @param {{lat:number, lng:number}} a
 * @param {{lat:number, lng:number}} b
 * @returns {number} kilometres
 */
export function haversineKm(a, b) {
  if (!a || !b) return NaN;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Return a NEW array of locations sorted ascending by distance from `center`,
 * each annotated with a `distanceKm` number. Locations without coordinates are
 * pushed to the end. Does not mutate the input array.
 * @param {Array<{lat:number, lng:number}>} locations
 * @param {{lat:number, lng:number} | null | undefined} center
 */
export function sortByDistance(locations, center) {
  const list = Array.isArray(locations) ? locations.slice() : [];
  if (!center || center.lat == null || center.lng == null) return list;

  const annotated = list.map((loc) => {
    const hasCoords = loc && loc.lat != null && loc.lng != null;
    const distanceKm = hasCoords
      ? haversineKm(center, { lat: Number(loc.lat), lng: Number(loc.lng) })
      : Infinity;
    return { ...loc, distanceKm: Number.isFinite(distanceKm) ? distanceKm : undefined };
  });

  annotated.sort((x, y) => {
    const dx = x.distanceKm == null ? Infinity : x.distanceKm;
    const dy = y.distanceKm == null ? Infinity : y.distanceKm;
    return dx - dy;
  });

  return annotated;
}

const KM_PER_MILE = 1.609344;

/**
 * Human-friendly distance label, e.g. "2.4 km" or "1.5 mi".
 * @param {number} km
 * @param {"metric"|"imperial"} [unitSystem="metric"]
 */
export function formatDistance(km, unitSystem = "metric") {
  if (km == null || !Number.isFinite(km)) return "";
  if (unitSystem === "imperial") {
    const mi = km / KM_PER_MILE;
    return `${mi.toFixed(mi < 10 ? 1 : 0)} mi`;
  }
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
