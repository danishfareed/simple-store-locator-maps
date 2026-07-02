import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { makeTestDb } from "../helpers/db";
import { shops, widgets } from "../../app/lib/db/schema";
import type { Database } from "../../app/lib/db/client.server";
import type { WidgetType } from "../../app/lib/db/schema";

const SECRET = "shhh-test-secret";

// proxy.widget.ts (via requireStorefront) calls getDb(env.DB) to obtain a
// Drizzle client. Route-level tests elsewhere in this suite mock
// lib/db/client.server so a real D1 binding is never required — swap in
// whatever in-memory test DB the current test built.
let currentDb: Database;
vi.mock("../../app/lib/db/client.server", () => ({
  getDb: () => currentDb,
}));

/** Sign an app-proxy request the way Shopify does (mirrors tests/unit/hmac.test.ts). */
function signedProxyUrl(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("");
  const hex = createHmac("sha256", secret).update(sorted).digest("hex");
  const url = new URL("https://example.com/proxy/widget");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("signature", hex);
  return url.toString();
}

function fakeContext() {
  return {
    cloudflare: {
      env: { SHOPIFY_API_SECRET: SECRET, DB: {} },
    },
  } as any;
}

async function seedWidget(
  db: Database,
  opts: { shopId: string; planHandle: "free" | "premium"; type: WidgetType },
) {
  const now = new Date();
  await db.insert(shops).values({
    id: opts.shopId,
    shopDomain: opts.shopId,
    planHandle: opts.planHandle,
    installedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(widgets).values({
    id: `${opts.shopId}-widget-1`,
    shopId: opts.shopId,
    handle: "default",
    name: "Default Widget",
    provider: "leaflet",
    type: opts.type,
    config: { type: opts.type },
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  });
}

describe("proxy.widget loader — render-time widget-type gate", () => {
  it("downgrades a saved premium widget type to map_list for a free shop", async () => {
    currentDb = await makeTestDb();
    await seedWidget(currentDb, {
      shopId: "free-shop.myshopify.com",
      planHandle: "free",
      type: "finder",
    });

    const { loader } = await import("../../app/routes/proxy.widget");
    const url = signedProxyUrl({ shop: "free-shop.myshopify.com", handle: "default" }, SECRET);
    const response = await loader({ request: new Request(url), context: fakeContext(), params: {} } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.widget.type).toBe("map_list");
  });

  it("keeps a saved premium widget type as-is for a premium shop", async () => {
    currentDb = await makeTestDb();
    await seedWidget(currentDb, {
      shopId: "premium-shop.myshopify.com",
      planHandle: "premium",
      type: "finder",
    });

    const { loader } = await import("../../app/routes/proxy.widget");
    const url = signedProxyUrl({ shop: "premium-shop.myshopify.com", handle: "default" }, SECRET);
    const response = await loader({ request: new Request(url), context: fakeContext(), params: {} } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.widget.type).toBe("finder");
  });

  it("free shop with an already-compliant map_list widget still renders map_list", async () => {
    currentDb = await makeTestDb();
    await seedWidget(currentDb, {
      shopId: "free-shop-2.myshopify.com",
      planHandle: "free",
      type: "map_list",
    });

    const { loader } = await import("../../app/routes/proxy.widget");
    const url = signedProxyUrl({ shop: "free-shop-2.myshopify.com", handle: "default" }, SECRET);
    const response = await loader({ request: new Request(url), context: fakeContext(), params: {} } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.widget.type).toBe("map_list");
  });

  it("premium shop downgraded to free also downgrades other premium-only types (carousel)", async () => {
    currentDb = await makeTestDb();
    await seedWidget(currentDb, {
      shopId: "free-shop-3.myshopify.com",
      planHandle: "free",
      type: "carousel",
    });

    const { loader } = await import("../../app/routes/proxy.widget");
    const url = signedProxyUrl({ shop: "free-shop-3.myshopify.com", handle: "default" }, SECRET);
    const response = await loader({ request: new Request(url), context: fakeContext(), params: {} } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.widget.type).toBe("map_list");
  });
});
