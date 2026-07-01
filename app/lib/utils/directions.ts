/**
 * Pure, dependency-free helper for building an external "get directions"
 * deep link. No DOM, no server imports — safe to bundle into the storefront
 * widget JS as well as the admin.
 */
export function directionsUrl(
  loc: { lat: number; lng: number },
  provider: "google" | "apple",
): string {
  if (provider === "apple") {
    return `https://maps.apple.com/?daddr=${loc.lat},${loc.lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
}
