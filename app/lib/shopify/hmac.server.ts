/**
 * App-proxy & webhook HMAC verification using the Web Crypto API (Workers-native).
 *
 * - App proxy: Shopify sorts the remaining query params, concatenates them as
 *   `key=value`, then HMAC-SHA256s with the app secret. Result is sent as the
 *   `signature` param in hex.
 * - Webhooks: Shopify HMAC-SHA256s the raw body and sends the base64 result as
 *   `X-Shopify-Hmac-Sha256`.
 */

const HEX_PATTERN = /^[0-9a-f]+$/i;

export async function verifyAppProxy(
  request: Request,
  secret: string,
): Promise<URL | null> {
  const url = new URL(request.url);
  const signature = url.searchParams.get("signature");
  if (!signature) return null;
  // Reject malformed hex up front: a non-hex signature must never verify.
  // (timingSafeEqualHex is hardened too, but this is the clearest gate.)
  if (!HEX_PATTERN.test(signature)) return null;
  url.searchParams.delete("signature");

  const params = [...url.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("");

  const digest = await hmacSha256Hex(secret, params);
  return timingSafeEqualHex(digest, signature) ? url : null;
}

export async function verifyWebhook(
  request: Request,
  secret: string,
): Promise<{ raw: string; valid: boolean }> {
  const header = request.headers.get("x-shopify-hmac-sha256") ?? "";
  const raw = await request.text();
  const digest = await hmacSha256Base64(secret, raw);
  return { raw, valid: timingSafeEqualString(digest, header) };
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const sig = await hmacSha256Raw(secret, message);
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const sig = await hmacSha256Raw(secret, message);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacSha256Raw(secret: string, message: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, enc.encode(message));
}

// Exported for direct unit testing of the constant-time hex compare — the
// NaN-coercion edge case it guards against is otherwise very hard to
// exercise deterministically through the public verifyAppProxy surface
// (it only manifests when a REAL digest byte happens to be 0x00).
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 2) {
    const byteA = parseInt(a.substr(i, 2), 16);
    const byteB = parseInt(b.substr(i, 2), 16);
    // parseInt("1g", 16) parses the valid leading digits and ignores the
    // rest, and a fully-invalid pair yields NaN — and NaN ^ 0 === 0, which
    // would spuriously "match" a zero byte. Force a mismatch instead of
    // trusting the coercion.
    if (Number.isNaN(byteA) || Number.isNaN(byteB)) {
      diff |= 1;
      continue;
    }
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
