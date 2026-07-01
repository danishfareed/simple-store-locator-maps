import { describe, it, expect } from "vitest";
import { WIDGET_TYPES, WIDGET_TYPE_ORDER } from "../../app/features/widgets/widget-types";
import { WidgetTypeEnum } from "../../app/schemas/widget.schema";

describe("WIDGET_TYPES", () => {
  it("has an entry for every WidgetType", () => {
    for (const type of WidgetTypeEnum.options) {
      expect(WIDGET_TYPES[type]).toBeDefined();
      expect(WIDGET_TYPES[type].id).toBe(type);
    }
  });

  it("only map_list is free (requiresPremium=false)", () => {
    const freeTypes = Object.values(WIDGET_TYPES).filter((t) => !t.requiresPremium);
    expect(freeTypes.map((t) => t.id)).toEqual(["map_list"]);
  });

  it("marks every non-map_list type as requiring premium", () => {
    for (const [id, meta] of Object.entries(WIDGET_TYPES)) {
      if (id === "map_list") continue;
      expect(meta.requiresPremium).toBe(true);
    }
  });

  it("list does not require a map (requiresMap=false)", () => {
    expect(WIDGET_TYPES.list.requiresMap).toBe(false);
  });

  it("every entry has label, description, and icon", () => {
    for (const meta of Object.values(WIDGET_TYPES)) {
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
      expect(typeof meta.description).toBe("string");
      expect(meta.description.length).toBeGreaterThan(0);
      expect(typeof meta.icon).toBe("string");
      expect(meta.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("WIDGET_TYPE_ORDER", () => {
  it("lists every WidgetType exactly once", () => {
    expect(WIDGET_TYPE_ORDER.length).toBe(WidgetTypeEnum.options.length);
    expect(new Set(WIDGET_TYPE_ORDER).size).toBe(WIDGET_TYPE_ORDER.length);
    for (const type of WidgetTypeEnum.options) {
      expect(WIDGET_TYPE_ORDER).toContain(type);
    }
  });

  it("starts with map_list (the free plan default)", () => {
    expect(WIDGET_TYPE_ORDER[0]).toBe("map_list");
  });
});
