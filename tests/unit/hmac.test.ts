import { describe, it, expect } from "vitest";
import { verifyAppProxy, verifyWebhook } from "../../app/lib/shopify/hmac.server";

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
