import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the storefront auth gate so route tests don't need to hand-sign HMAC
// requests — they just control what `requireStorefront()` resolves to,
// mirroring the pattern in tests/unit/gdpr-webhooks.test.ts.
const requireStorefront = vi.fn();
vi.mock("../../app/lib/auth/storefront.server", () => ({
  requireStorefront: (...args: unknown[]) => requireStorefront(...args),
}));

const incrementStorefrontRequest = vi.fn();
vi.mock("../../app/services/quota.service.server", () => ({
  incrementStorefrontRequest: (...args: unknown[]) =>
    incrementStorefrontRequest(...args),
}));

const recordEvent = vi.fn();
vi.mock("../../app/repositories/analytics.repository.server", () => ({
  recordEvent: (...args: unknown[]) => recordEvent(...args),
}));

const fakeDb = {};
const fakeShop = { id: "demo.myshopify.com", planHandle: "free" };
const fakeEnv = { SESSION_SECRET: "test-secret" };

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request(
    "https://example.com/proxy/event?shop=demo.myshopify.com&signature=abc",
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
  );
}

const fakeContext = { cloudflare: { env: {} } } as any;

describe("proxy/event", () => {
  beforeEach(() => {
    requireStorefront.mockReset();
    incrementStorefrontRequest.mockReset().mockResolvedValue(true);
    recordEvent.mockReset().mockResolvedValue(undefined);
  });

  it("returns 401 when HMAC verification fails", async () => {
    requireStorefront.mockResolvedValue({
      ok: false,
      response: new Response("Invalid signature", { status: 401 }),
    });

    const { action } = await import("../../app/routes/proxy.event");
    const res = await action({
      request: makeRequest({ type: "view" }),
      context: fakeContext,
    } as any);

    expect(res.status).toBe(401);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("returns 204 and records a valid event", async () => {
    const url = new URL(
      "https://example.com/proxy/event?shop=demo.myshopify.com&signature=abc",
    );
    requireStorefront.mockResolvedValue({
      ok: true,
      url,
      shop: fakeShop,
      db: fakeDb,
      env: fakeEnv,
    });

    const { action } = await import("../../app/routes/proxy.event");
    const res = await action({
      request: makeRequest(
        { type: "click", locationId: "loc-1", widgetId: "widget-1" },
        { "cf-ipcountry": "US", "user-agent": "vitest", referer: "https://shop.example" },
      ),
      context: fakeContext,
    } as any);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(recordEvent).toHaveBeenCalledTimes(1);
    const [, evt] = recordEvent.mock.calls[0];
    expect(evt).toMatchObject({
      shopId: "demo.myshopify.com",
      eventType: "click",
      locationId: "loc-1",
      widgetId: "widget-1",
      countryCode: "US",
      userAgent: "vitest",
      referer: "https://shop.example",
    });
    expect(evt.id).toEqual(expect.any(String));
  });

  it("accepts every enum event type", async () => {
    const url = new URL(
      "https://example.com/proxy/event?shop=demo.myshopify.com&signature=abc",
    );
    requireStorefront.mockResolvedValue({
      ok: true,
      url,
      shop: fakeShop,
      db: fakeDb,
      env: fakeEnv,
    });

    const { action } = await import("../../app/routes/proxy.event");
    for (const type of [
      "search",
      "view",
      "click",
      "directions",
      "call",
      "impression",
    ]) {
      recordEvent.mockClear();
      const res = await action({
        request: makeRequest({ type }),
        context: fakeContext,
      } as any);
      expect(res.status).toBe(204);
      expect(recordEvent).toHaveBeenCalledTimes(1);
    }
  });

  it("returns 400 for an invalid event type", async () => {
    const url = new URL(
      "https://example.com/proxy/event?shop=demo.myshopify.com&signature=abc",
    );
    requireStorefront.mockResolvedValue({
      ok: true,
      url,
      shop: fakeShop,
      db: fakeDb,
      env: fakeEnv,
    });

    const { action } = await import("../../app/routes/proxy.event");
    const res = await action({
      request: makeRequest({ type: "not-a-real-event" }),
      context: fakeContext,
    } as any);

    expect(res.status).toBe(400);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed JSON body", async () => {
    const url = new URL(
      "https://example.com/proxy/event?shop=demo.myshopify.com&signature=abc",
    );
    requireStorefront.mockResolvedValue({
      ok: true,
      url,
      shop: fakeShop,
      db: fakeDb,
      env: fakeEnv,
    });

    const { action } = await import("../../app/routes/proxy.event");
    const badReq = new Request(
      "https://example.com/proxy/event?shop=demo.myshopify.com&signature=abc",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      },
    );
    const res = await action({ request: badReq, context: fakeContext } as any);

    expect(res.status).toBe(400);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    const url = new URL(
      "https://example.com/proxy/event?shop=demo.myshopify.com&signature=abc",
    );
    requireStorefront.mockResolvedValue({
      ok: true,
      url,
      shop: fakeShop,
      db: fakeDb,
      env: fakeEnv,
    });
    incrementStorefrontRequest.mockResolvedValue(false);

    const { action } = await import("../../app/routes/proxy.event");
    const res = await action({
      request: makeRequest({ type: "view" }),
      context: fakeContext,
    } as any);

    expect(res.status).toBe(429);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});
