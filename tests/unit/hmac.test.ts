import { describe, it, expect } from "vitest";
import {
  verifyAppProxy,
  verifyWebhook,
  timingSafeEqualHex,
} from "../../app/lib/shopify/hmac.server";

const SECRET = "shhh-test-secret";

function buildSignedUrl(params: Record<string, string>, secret: string) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("");
  // sign with Node's crypto — the verify side uses Web Crypto.
  const { createHmac } = require("node:crypto");
  const hex = createHmac("sha256", secret).update(sorted).digest("hex");
  const url = new URL("https://example.com/proxy/locations");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("signature", hex);
  return url.toString();
}

describe("verifyAppProxy", () => {
  it("accepts a correctly signed request", async () => {
    const url = buildSignedUrl(
      { shop: "demo.myshopify.com", path_prefix: "/apps/locator", timestamp: "1700000000" },
      SECRET,
    );
    const req = new Request(url);
    const out = await verifyAppProxy(req, SECRET);
    expect(out).not.toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const url = buildSignedUrl({ shop: "demo.myshopify.com" }, "wrong-secret");
    const req = new Request(url);
    const out = await verifyAppProxy(req, SECRET);
    expect(out).toBeNull();
  });

  it("rejects a missing signature", async () => {
    const req = new Request("https://example.com/proxy/locations?shop=demo.myshopify.com");
    const out = await verifyAppProxy(req, SECRET);
    expect(out).toBeNull();
  });

  it("rejects a signature containing non-hex characters", async () => {
    const url = buildSignedUrl({ shop: "demo.myshopify.com" }, SECRET);
    const tampered = new URL(url);
    // Overwrite the (correctly-sized) signature with a non-hex string so a
    // naive parseInt(x, 16) implementation would coerce the bad chars to
    // NaN, and NaN ^ 0 === 0 would spuriously "match".
    const badSig = "g".repeat(tampered.searchParams.get("signature")!.length);
    tampered.searchParams.set("signature", badSig);
    const req = new Request(tampered.toString());
    const out = await verifyAppProxy(req, SECRET);
    expect(out).toBeNull();
  });

  it("still accepts a valid signature after hex validation is enforced", async () => {
    const url = buildSignedUrl(
      { shop: "demo.myshopify.com", path_prefix: "/apps/locator" },
      SECRET,
    );
    const req = new Request(url);
    const out = await verifyAppProxy(req, SECRET);
    expect(out).not.toBeNull();
  });
});

describe("timingSafeEqualHex", () => {
  it("matches two identical hex strings", () => {
    expect(timingSafeEqualHex("00ff1a", "00ff1a")).toBe(true);
  });

  it("does not match when a byte genuinely differs", () => {
    expect(timingSafeEqualHex("00ff1a", "00ff1b")).toBe(false);
  });

  it("does not match different lengths", () => {
    expect(timingSafeEqualHex("00ff", "00ff1a")).toBe(false);
  });

  it("does not spuriously match a zero byte against a malformed (non-hex) byte pair", () => {
    // Old bug: parseInt("zz", 16) is NaN, and NaN ^ 0 === 0 (ToInt32(NaN) = 0),
    // so a malformed pair would silently "match" wherever the other side's
    // byte happened to be 0x00. A malformed pair must never match ANY byte,
    // including a real zero byte.
    expect(timingSafeEqualHex("00ff1a", "zzff1a")).toBe(false);
  });

  it("does not spuriously match two malformed byte pairs at the same position", () => {
    // NaN ^ NaN also coerces to 0 under the old implementation.
    expect(timingSafeEqualHex("zzff1a", "zzff1a")).toBe(false);
  });
});

describe("verifyWebhook", () => {
  it("accepts a correctly signed body", async () => {
    const body = JSON.stringify({ id: 1 });
    const { createHmac } = await import("node:crypto");
    const b64 = createHmac("sha256", SECRET).update(body).digest("base64");
    const req = new Request("https://example.com/webhooks/app/uninstalled", {
      method: "POST",
      headers: { "x-shopify-hmac-sha256": b64 },
      body,
    });
    const { valid } = await verifyWebhook(req, SECRET);
    expect(valid).toBe(true);
  });

  it("rejects a body with no HMAC header", async () => {
    const req = new Request("https://example.com/webhooks/app/uninstalled", {
      method: "POST",
      body: "{}",
    });
    const { valid } = await verifyWebhook(req, SECRET);
    expect(valid).toBe(false);
  });
});
