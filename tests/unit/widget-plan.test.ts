import { describe, it, expect } from "vitest";
import { applyPlanToConfig } from "../../app/lib/billing/plans";
import type { WidgetConfig } from "../../app/lib/db/schema";

/** A config with every premium config feature populated, on a premium-only type. */
function premiumLadenConfig(): WidgetConfig {
  return {
    type: "finder",
    defaultCenter: { lat: 40.7128, lng: -74.006 },
    defaultZoom: 12,
    clustering: true,
    enableNearMe: true,
    categories: ["bakery", "cafe"],
    filters: { services: ["wifi"], countries: ["US"] },
    theme: { primaryColor: "#ff0000", fontFamily: "Inter" },
    heroHeight: 320,
    showFilterBar: true,
  };
}

describe("applyPlanToConfig", () => {
  it("free plan strips theme + categories/filters, forces clustering/enableNearMe false", () => {
    const result = applyPlanToConfig(premiumLadenConfig(), "free");

    expect(result.theme).toBeUndefined();
    expect(result.categories).toBeUndefined();
    expect(result.filters).toBeUndefined();
    expect(result.clustering).toBe(false);
    expect(result.enableNearMe).toBe(false);
  });

  it("premium plan keeps all premium config features", () => {
    const input = premiumLadenConfig();
    const result = applyPlanToConfig(input, "premium");

    expect(result.theme).toEqual(input.theme);
    expect(result.categories).toEqual(input.categories);
    expect(result.filters).toEqual(input.filters);
    expect(result.clustering).toBe(true);
    expect(result.enableNearMe).toBe(true);
  });

  it("preserves the type discriminant and base fields on free", () => {
    const input = premiumLadenConfig();
    const result = applyPlanToConfig(input, "free");

    expect(result.type).toBe("finder");
    expect(result.defaultCenter).toEqual(input.defaultCenter);
    expect(result.defaultZoom).toBe(12);
  });

  it("preserves the type discriminant and base fields on premium", () => {
    const input = premiumLadenConfig();
    const result = applyPlanToConfig(input, "premium");

    expect(result.type).toBe("finder");
    expect(result.defaultCenter).toEqual(input.defaultCenter);
    expect(result.defaultZoom).toBe(12);
  });

  it("preserves per-type extras and show* toggles untouched", () => {
    const input: WidgetConfig = {
      type: "map_list",
      showHours: true,
      showPhone: false,
      showDirections: true,
      sidebarPosition: "right",
      resultsPerPage: 25,
    };
    const result = applyPlanToConfig(input, "free");

    expect(result.showHours).toBe(true);
    expect(result.showPhone).toBe(false);
    expect(result.showDirections).toBe(true);
    expect(result.sidebarPosition).toBe("right");
    expect(result.resultsPerPage).toBe(25);
  });

  it("does not mutate the input config (shallow clone)", () => {
    const input = premiumLadenConfig();
    const before = JSON.stringify(input);
    applyPlanToConfig(input, "free");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("treats an unknown plan handle like free (strips premium features)", () => {
    const result = applyPlanToConfig(premiumLadenConfig(), "starter");
    expect(result.theme).toBeUndefined();
    expect(result.clustering).toBe(false);
    expect(result.enableNearMe).toBe(false);
    expect(result.categories).toBeUndefined();
    expect(result.filters).toBeUndefined();
  });
});
