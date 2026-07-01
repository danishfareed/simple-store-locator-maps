/**
 * Hash the caller's IP for privacy-preserving analytics (never store raw
 * IPs). Truncated HMAC-SHA256 keyed on the app's session secret — deliberately
 * NOT reversible, only usable for rough uniqueness/rate-limit heuristics.
 */
export async function hashIp(request: Request, secret: string): Promise<string | null> {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(ip));
  return [...new Uint8Array(sig)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
