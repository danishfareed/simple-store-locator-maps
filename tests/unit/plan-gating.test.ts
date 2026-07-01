import { describe, it, expect } from "vitest";
import { PlanFeatureError } from "../../app/services/quota.service.server";
import { assertWidgetTypeAllowed } from "../../app/services/widget.service.server";
import { assertImportKindAllowed } from "../../app/services/import.service.server";
import { resolveProvider } from "../../app/services/provider.service.server";

describe("PlanFeatureError", () => {
  it("carries the feature, plan, and a descriptive message", () => {
    const err = new PlanFeatureError("carousel widget", "free");
    expect(err.name).toBe("PlanFeatureError");
    expect(err.message).toContain("carousel widget");
    expect(err.message).toContain("free");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("assertWidgetTypeAllowed", () => {
  it("allows free to use map_list", () => {
    expect(() => assertWidgetTypeAllowed("free", "map_list")).not.toThrow();
  });

  it("throws PlanFeatureError when free requests a premium widget type", () => {
    expect(() => assertWidgetTypeAllowed("free", "carousel")).toThrow(PlanFeatureError);
    expect(() => assertWidgetTypeAllowed("free", "finder")).toThrow(PlanFeatureError);
    expect(() => assertWidgetTypeAllowed("free", "list")).toThrow(PlanFeatureError);
    expect(() => assertWidgetTypeAllowed("free", "single")).toThrow(PlanFeatureError);
  });

  it("allows premium to use any widget type", () => {
    for (const type of ["map_list", "finder", "carousel", "list", "single"] as const) {
      expect(() => assertWidgetTypeAllowed("premium", type)).not.toThrow();
    }
  });
});

describe("assertImportKindAllowed", () => {
  it("allows free to import csv", () => {
    expect(() => assertImportKindAllowed("free", "csv")).not.toThrow();
  });

  it("throws PlanFeatureError when free requests an xlsx import", () => {
    expect(() => assertImportKindAllowed("free", "xlsx")).toThrow(PlanFeatureError);
  });

  it("allows premium to import both kinds", () => {
    expect(() => assertImportKindAllowed("premium", "csv")).not.toThrow();
    expect(() => assertImportKindAllowed("premium", "xlsx")).not.toThrow();
  });
});

describe("resolveProvider (plan-aware)", () => {
  it("forces free to leaflet even when google is requested with a key", () => {
    const p = resolveProvider("google", { hasApiKey: true, planHandle: "free" });
    expect(p.id).toBe("leaflet");
  });

  it("lets premium use google when a key is present", () => {
    const p = resolveProvider("google", { hasApiKey: true, planHandle: "premium" });
    expect(p.id).toBe("google");
  });

  it("falls back to leaflet for premium google without a key", () => {
    const p = resolveProvider("google", { hasApiKey: false, planHandle: "premium" });
    expect(p.id).toBe("leaflet");
  });

  it("always permits leaflet", () => {
    expect(resolveProvider("leaflet", { hasApiKey: false, planHandle: "free" }).id).toBe(
      "leaflet",
    );
  });
});
