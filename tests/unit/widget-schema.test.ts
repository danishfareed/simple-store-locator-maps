import { describe, it, expect } from "vitest";
import { WidgetInputSchema, WidgetConfigSchema } from "../../app/schemas/widget.schema";

describe("WidgetInputSchema", () => {
  it("accepts a valid map_list widget", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "default",
      name: "Store map",
      provider: "leaflet",
      type: "map_list",
      isPublished: true,
      config: { type: "map_list", sidebarPosition: "left", resultsPerPage: 10, defaultZoom: 10 },
    });
    expect(r.success).toBe(true);
  });

  it("rejects carousel-only fields on a list widget", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "x",
      name: "n",
      provider: "leaflet",
      type: "list",
      isPublished: false,
      config: { type: "list", cardsPerView: 3 },
    });
    expect(r.success).toBe(false);
  });

  it("requires locationId for single type", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "x",
      name: "n",
      provider: "leaflet",
      type: "single",
      isPublished: false,
      config: { type: "single" },
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid single widget with a locationId", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "x",
      name: "n",
      provider: "leaflet",
      type: "single",
      isPublished: false,
      config: { type: "single", locationId: "loc-1", showContactForm: true },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a valid finder widget", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "x",
      name: "n",
      provider: "leaflet",
      type: "finder",
      isPublished: false,
      config: { type: "finder", heroHeight: 400, showFilterBar: true },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a valid carousel widget", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "x",
      name: "n",
      provider: "leaflet",
      type: "carousel",
      isPublished: false,
      config: { type: "carousel", cardsPerView: 3, autoplay: true, showMiniMap: false },
    });
    expect(r.success).toBe(true);
  });

  it("accepts a valid list widget", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "x",
      name: "n",
      provider: "leaflet",
      type: "list",
      isPublished: false,
      config: { type: "list", columns: 2, showMapLink: true },
    });
    expect(r.success).toBe(true);
  });

  it("rejects when top-level type and config.type disagree", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "x",
      name: "n",
      provider: "leaflet",
      type: "map_list",
      isPublished: false,
      config: { type: "finder", heroHeight: 400 },
    });
    expect(r.success).toBe(false);
  });

  it("accepts shared base config fields (theme, filters, clustering) on any variant", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "x",
      name: "n",
      provider: "leaflet",
      type: "map_list",
      isPublished: false,
      config: {
        type: "map_list",
        defaultCenter: { lat: 40, lng: -73 },
        defaultZoom: 12,
        searchRadiusKm: 50,
        showHours: true,
        showPhone: true,
        showDirections: true,
        clustering: true,
        enableNearMe: true,
        categories: ["cafe", "retail"],
        filters: { services: ["wifi"], countries: ["US"] },
        theme: {
          primaryColor: "#112233",
          markerColor: "#445566",
          backgroundColor: "#ffffff",
          textColor: "#000000",
          fontFamily: "Inter",
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown widget type", () => {
    const r = WidgetInputSchema.safeParse({
      handle: "x",
      name: "n",
      provider: "leaflet",
      type: "bogus",
      isPublished: false,
      config: { type: "bogus" },
    });
    expect(r.success).toBe(false);
  });
});

describe("WidgetConfigSchema", () => {
  it("is a discriminated union keyed on type", () => {
    const r = WidgetConfigSchema.safeParse({ type: "map_list" });
    expect(r.success).toBe(true);
  });
});
