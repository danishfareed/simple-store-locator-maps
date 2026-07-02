import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Shopify app factory so route tests don't need to hand-sign HMAC
// requests — they just control what `authenticate.webhook()` resolves/throws,
// mirroring the pattern documented in tests/setup.ts ("route tests mock the
// Shopify authenticate() calls").
const authenticateWebhook = vi.fn();
vi.mock("../../app/shopify.server", () => ({
  getShopify: () => ({
    authenticate: { webhook: authenticateWebhook },
  }),
}));

// Mock the GDPR service so webhook tests assert *that* the service was
// called with the right args, without needing a real DB.
const purgeShopData = vi.fn();
const customerDataReport = vi.fn().mockResolvedValue({ heldData: ["none"] });
const redactCustomer = vi.fn();
vi.mock("../../app/services/gdpr.service.server", () => ({
  purgeShopData: (...args: unknown[]) => purgeShopData(...args),
  customerDataReport: (...args: unknown[]) => customerDataReport(...args),
  redactCustomer: (...args: unknown[]) => redactCustomer(...args),
}));

// Mock getDb since routes call it before invoking the (mocked) service.
vi.mock("../../app/lib/db/client.server", () => ({
  getDb: () => ({}),
}));

const fakeUploads = { list: vi.fn(), delete: vi.fn() };

const fakeContext = {
  cloudflare: {
    env: { DB: {}, UPLOADS: fakeUploads },
  },
} as any;

function makeRequest(body: unknown) {
  return new Request("https://example.com/webhooks/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("gdpr webhooks", () => {
  beforeEach(() => {
    authenticateWebhook.mockReset();
    purgeShopData.mockReset();
    customerDataReport.mockReset().mockResolvedValue({ heldData: ["none"] });
    redactCustomer.mockReset();
  });

  describe("webhooks/customers/data_request", () => {
    it("returns 200 on valid HMAC and produces a report", async () => {
      const { action } = await import(
        "../../app/routes/webhooks.customers.data_request"
      );
      authenticateWebhook.mockResolvedValue({
        topic: "CUSTOMERS_DATA_REQUEST",
        shop: "demo.myshopify.com",
        payload: { customer: { id: "cust-1" } },
      });

      const res = await action({ request: makeRequest({}), context: fakeContext } as any);

      expect(res.status).toBe(200);
      expect(customerDataReport).toHaveBeenCalledWith(
        expect.anything(),
        "demo.myshopify.com",
        "cust-1",
      );
    });

    it("returns 401 when HMAC verification fails", async () => {
      const { action } = await import(
        "../../app/routes/webhooks.customers.data_request"
      );
      authenticateWebhook.mockRejectedValue(
        new Response("Unauthorized", { status: 401 }),
      );

      const res = await action({ request: makeRequest({}), context: fakeContext } as any);

      expect(res.status).toBe(401);
    });
  });

  describe("webhooks/customers/redact", () => {
    it("returns 200 on valid HMAC and calls redactCustomer", async () => {
      const { action } = await import("../../app/routes/webhooks.customers.redact");
      authenticateWebhook.mockResolvedValue({
        topic: "CUSTOMERS_REDACT",
        shop: "demo.myshopify.com",
        payload: { customer: { id: "cust-1" } },
      });

      const res = await action({ request: makeRequest({}), context: fakeContext } as any);

      expect(res.status).toBe(200);
      expect(redactCustomer).toHaveBeenCalledWith(
        expect.anything(),
        "demo.myshopify.com",
        "cust-1",
      );
    });

    it("returns 401 when HMAC verification fails", async () => {
      const { action } = await import("../../app/routes/webhooks.customers.redact");
      authenticateWebhook.mockRejectedValue(
        new Response("Unauthorized", { status: 401 }),
      );

      const res = await action({ request: makeRequest({}), context: fakeContext } as any);

      expect(res.status).toBe(401);
    });
  });

  describe("webhooks/shop/redact", () => {
    it("returns 200 on valid HMAC and calls purgeShopData", async () => {
      const { action } = await import("../../app/routes/webhooks.shop.redact");
      authenticateWebhook.mockResolvedValue({
        topic: "SHOP_REDACT",
        shop: "demo.myshopify.com",
        payload: {},
      });

      const res = await action({ request: makeRequest({}), context: fakeContext } as any);

      expect(res.status).toBe(200);
      expect(purgeShopData).toHaveBeenCalledWith(
        expect.anything(),
        "demo.myshopify.com",
        fakeUploads,
      );
    });

    it("returns 401 when HMAC verification fails", async () => {
      const { action } = await import("../../app/routes/webhooks.shop.redact");
      authenticateWebhook.mockRejectedValue(
        new Response("Unauthorized", { status: 401 }),
      );

      const res = await action({ request: makeRequest({}), context: fakeContext } as any);

      expect(res.status).toBe(401);
    });
  });
});
