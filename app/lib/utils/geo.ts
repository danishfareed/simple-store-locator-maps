const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = deg2rad(b.lat - a.lat);
  const dLng = deg2rad(b.lng - a.lng);
  const lat1 = deg2rad(a.lat);
  const lat2 = deg2rad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(x));
}

/** Rough bounding box around a centre point for a given radius. Wider than
 *  necessary near the poles — caller should refine with Haversine. */
export function bboxForRadius(
  centre: { lat: number; lng: number },
  radiusKm: number,
) {
  const latDelta = radiusKm / 111; // 1° lat ≈ 111 km
  const lngDelta = radiusKm / (111 * Math.max(Math.cos(deg2rad(centre.lat)), 0.01));
  return {
    minLat: centre.lat - latDelta,
    maxLat: centre.lat + latDelta,
    minLng: centre.lng - lngDelta,
    maxLng: centre.lng + lngDelta,
  };
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}
