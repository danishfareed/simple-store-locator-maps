import { describe, it, expect } from "vitest";
import { makeTestDb } from "../helpers/db";
import { shops } from "../../app/lib/db/schema";
import {
  saveWidget,
  getWidget,
  duplicateWidget,
} from "../../app/services/widget.service.server";
import { deleteWidget, listWidgets, getWidgetByHandle } from "../../app/repositories/widget.repository.server";
import { PlanFeatureError } from "../../app/services/quota.service.server";
import type { WidgetInput } from "../../app/schemas/widget.schema";

/** Seed a bare shop (no default widget) on the given plan. */
async function seedBareShop(shopId: string, planHandle: "free" | "premium" = "free") {
  const db = await makeTestDb();
  const now = new Date();
  await db.insert(shops).values({
    id: shopId,
    shopDomain: `${shopId}.myshopify.com`,
    planHandle,
    installedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return db;
}

function mapListInput(overrides: Partial<WidgetInput> = {}): WidgetInput {
  return {
    handle: "store-map",
    name: "Store Map",
    provider: "leaflet",
    type: "map_list",
    isPublished: false,
    config: { type: "map_list", sidebarPosition: "left" },
    ...overrides,
  } as WidgetInput;
}

function carouselInput(overrides: Partial<WidgetInput> = {}): WidgetInput {
  return {
    handle: "featured-carousel",
    name: "Featured Carousel",
    provider: "leaflet",
    type: "carousel",
    isPublished: false,
    config: { type: "carousel", cardsPerView: 3 },
    ...overrides,
  } as WidgetInput;
}

describe("saveWidget — plan gating", () => {
  it("creates a map_list widget on the free plan", async () => {
    const shopId = "ws-free-maplist";
    const db = await seedBareShop(shopId, "free");

    const widget = await saveWidget(db, shopId, mapListInput());

    expect(widget.type).toBe("map_list");
    expect(widget.handle).toBe("store-map");
    expect(widget.shopId).toBe(shopId);
  });

  it("throws PlanFeatureError creating a carousel widget on the free plan", async () => {
    const shopId = "ws-free-carousel";
    const db = await seedBareShop(shopId, "free");

    await expect(saveWidget(db, shopId, carouselInput())).rejects.toThrow(PlanFeatureError);

    // Nothing should have been persisted.
    const rows = await listWidgets(db, shopId);
    expect(rows).toHaveLength(0);
  });

  it("creates a carousel widget on the premium plan", async () => {
    const shopId = "ws-premium-carousel";
    const db = await seedBareShop(shopId, "premium");

    const widget = await saveWidget(db, shopId, carouselInput());

    expect(widget.type).toBe("carousel");
    expect(widget.config).toMatchObject({ type: "carousel", cardsPerView: 3 });
  });
});

describe("saveWidget / getWidget / getWidgetByHandle / listWidgets — round trip", () => {
  it("persists type, config, provider, handle, name, isPublished and round-trips via get/getByHandle/list", async () => {
    const shopId = "ws-roundtrip";
    const db = await seedBareShop(shopId, "premium");

    const saved = await saveWidget(
      db,
      shopId,
      mapListInput({ name: "My Widget", isPublished: true, provider: "google" }),
    );

    const byId = await getWidget(db, shopId, saved.id);
    expect(byId).toBeDefined();
    expect(byId?.type).toBe("map_list");
    expect(byId?.provider).toBe("google");
    expect(byId?.name).toBe("My Widget");
    expect(byId?.isPublished).toBe(true);
    expect(byId?.config).toMatchObject({ type: "map_list", sidebarPosition: "left" });

    const byHandle = await getWidgetByHandle(db, shopId, "store-map");
    expect(byHandle?.id).toBe(saved.id);

    const all = await listWidgets(db, shopId);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(saved.id);
  });
});

describe("saveWidget — handle uniqueness", () => {
  it("auto-suffixes the handle on create when it collides with another widget", async () => {
    const shopId = "ws-collision";
    const db = await seedBareShop(shopId, "free");

    const first = await saveWidget(db, shopId, mapListInput({ name: "First" }));
    expect(first.handle).toBe("store-map");

    const second = await saveWidget(db, shopId, mapListInput({ name: "Second" }));
    expect(second.handle).toBe("store-map-2");
    expect(second.id).not.toBe(first.id);

    const third = await saveWidget(db, shopId, mapListInput({ name: "Third" }));
    expect(third.handle).toBe("store-map-3");

    const all = await listWidgets(db, shopId);
    expect(all).toHaveLength(3);
  });

  it("on edit, keeps the widget's own handle without colliding with itself", async () => {
    const shopId = "ws-edit-same-handle";
    const db = await seedBareShop(shopId, "free");

    const created = await saveWidget(db, shopId, mapListInput({ name: "Original" }));

    const edited = await saveWidget(
      db,
      shopId,
      mapListInput({ name: "Renamed" }),
      created.id,
    );

    expect(edited.id).toBe(created.id);
    expect(edited.handle).toBe("store-map");
    expect(edited.name).toBe("Renamed");

    const all = await listWidgets(db, shopId);
    expect(all).toHaveLength(1);
  });

  it("on edit, auto-suffixes if changed handle collides with a DIFFERENT widget", async () => {
    const shopId = "ws-edit-collision";
    const db = await seedBareShop(shopId, "free");

    const widgetA = await saveWidget(db, shopId, mapListInput({ handle: "widget-a", name: "A" }));
    const widgetB = await saveWidget(db, shopId, mapListInput({ handle: "widget-b", name: "B" }));

    const edited = await saveWidget(
      db,
      shopId,
      mapListInput({ handle: "widget-a", name: "B renamed" }),
      widgetB.id,
    );

    expect(edited.id).toBe(widgetB.id);
    expect(edited.handle).toBe("widget-a-2");
    expect(widgetA.handle).toBe("widget-a");
  });
});

describe("duplicateWidget", () => {
  it("creates a copy with new id, unique handle, '(copy)' name, and isPublished=false", async () => {
    const shopId = "ws-duplicate";
    const db = await seedBareShop(shopId, "premium");

    const original = await saveWidget(
      db,
      shopId,
      carouselInput({ name: "Featured Carousel", isPublished: true }),
    );

    const copy = await duplicateWidget(db, shopId, original.id);

    expect(copy.id).not.toBe(original.id);
    expect(copy.handle).toBe("featured-carousel-copy");
    expect(copy.name).toBe("Featured Carousel (copy)");
    expect(copy.isPublished).toBe(false);
    expect(copy.type).toBe("carousel");
    expect(copy.config).toMatchObject({ type: "carousel", cardsPerView: 3 });

    const all = await listWidgets(db, shopId);
    expect(all).toHaveLength(2);
  });

  it("auto-suffixes the copy handle when duplicating more than once", async () => {
    const shopId = "ws-duplicate-twice";
    const db = await seedBareShop(shopId, "premium");

    const original = await saveWidget(db, shopId, mapListInput({ name: "Store Map" }));

    const copy1 = await duplicateWidget(db, shopId, original.id);
    expect(copy1.handle).toBe("store-map-copy");

    const copy2 = await duplicateWidget(db, shopId, original.id);
    expect(copy2.handle).toBe("store-map-copy-2");
    expect(copy2.name).toBe("Store Map (copy)");

    const all = await listWidgets(db, shopId);
    expect(all).toHaveLength(3);
  });
});

describe("deleteWidget", () => {
  it("removes the widget from the shop", async () => {
    const shopId = "ws-delete";
    const db = await seedBareShop(shopId, "free");

    const widget = await saveWidget(db, shopId, mapListInput());
    expect(await listWidgets(db, shopId)).toHaveLength(1);

    await deleteWidget(db, shopId, widget.id);

    expect(await listWidgets(db, shopId)).toHaveLength(0);
    expect(await getWidget(db, shopId, widget.id)).toBeUndefined();
  });
});
