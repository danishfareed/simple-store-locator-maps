import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_FREE,
  PLAN_PREMIUM,
  PREMIUM_ANNUAL_CENTS,
  BILLING_CONFIG,
  BILLING_KEY_PREMIUM_MONTHLY,
  BILLING_KEY_PREMIUM_ANNUAL,
  billingKeyToPlanHandle,
  planAllows,
  planAllowsWidgetType,
  planAllowsProvider,
  planAllowsImportKind,
  planFeatures,
  planMaxLocations,
  planShowsPoweredBy,
} from "../../app/lib/billing/plans";

describe("PLANS", () => {
  it("exposes exactly two active plans: free + premium", () => {
    expect(PLANS.map((p) => p.handle)).toEqual(["free", "premium"]);
    expect(PLANS.every((p) => p.isActive)).toBe(true);
  });

  it("prices premium at $14.99/mo (1499 cents) with a 7-day trial", () => {
    expect(PLAN_PREMIUM.priceCents).toBe(1499);
    expect(PLAN_PREMIUM.trialDays).toBe(7);
  });

  it("exposes an annual price of $149.90 (14990 cents) as a constant", () => {
    expect(PREMIUM_ANNUAL_CENTS).toBe(14990);
  });

  it("prices free at $0 with no trial", () => {
    expect(PLAN_FREE.priceCents).toBe(0);
    expect(PLAN_FREE.trialDays).toBe(0);
  });
});

describe("planMaxLocations", () => {
  it("caps free at 3 locations", () => {
    expect(planMaxLocations("free")).toBe(3);
  });

  it("caps premium at 100 locations", () => {
    expect(planMaxLocations("premium")).toBe(100);
  });

  it("defaults unknown handles to the free cap", () => {
    expect(planMaxLocations("starter")).toBe(3);
  });
});

describe("planAllowsWidgetType", () => {
  it("restricts free to map_list only", () => {
    expect(planAllowsWidgetType("free", "map_list")).toBe(true);
    expect(planAllowsWidgetType("free", "carousel")).toBe(false);
    expect(planAllowsWidgetType("free", "finder")).toBe(false);
    expect(planAllowsWidgetType("free", "list")).toBe(false);
    expect(planAllowsWidgetType("free", "single")).toBe(false);
  });

  it("allows every widget type on premium", () => {
    for (const type of ["map_list", "finder", "carousel", "list", "single"] as const) {
      expect(planAllowsWidgetType("premium", type)).toBe(true);
    }
  });
});

describe("planAllowsProvider", () => {
  it("free may use leaflet but not google", () => {
    expect(planAllowsProvider("free", "leaflet")).toBe(true);
    expect(planAllowsProvider("free", "google")).toBe(false);
  });

  it("premium may use both providers", () => {
    expect(planAllowsProvider("premium", "leaflet")).toBe(true);
    expect(planAllowsProvider("premium", "google")).toBe(true);
  });
});

describe("planAllowsImportKind", () => {
  it("free may import csv but not xlsx", () => {
    expect(planAllowsImportKind("free", "csv")).toBe(true);
    expect(planAllowsImportKind("free", "xlsx")).toBe(false);
  });

  it("premium may import both kinds", () => {
    expect(planAllowsImportKind("premium", "csv")).toBe(true);
    expect(planAllowsImportKind("premium", "xlsx")).toBe(true);
  });
});

describe("planShowsPoweredBy", () => {
  it("shows branding on free, hides it on premium", () => {
    expect(planShowsPoweredBy("free")).toBe(true);
    expect(planShowsPoweredBy("premium")).toBe(false);
  });
});

describe("planFeatures / planAllows", () => {
  it("reports free features and denies premium-only flags", () => {
    expect(planFeatures("free")).toContain("csv_import");
    expect(planAllows("free", "xlsx_import")).toBe(false);
    expect(planAllows("free", "remove_branding")).toBe(false);
  });

  it("reports premium features", () => {
    expect(planAllows("premium", "google_maps")).toBe(true);
    expect(planAllows("premium", "all_widgets")).toBe(true);
  });
});

describe("BILLING_CONFIG", () => {
  it("maps monthly + annual billing keys to the premium tier", () => {
    expect(billingKeyToPlanHandle(BILLING_KEY_PREMIUM_MONTHLY)).toBe("premium");
    expect(billingKeyToPlanHandle(BILLING_KEY_PREMIUM_ANNUAL)).toBe("premium");
    expect(billingKeyToPlanHandle("free")).toBe("free");
  });

  it("configures both keys with a 7-day trial and correct amounts/intervals", () => {
    const monthly = BILLING_CONFIG[BILLING_KEY_PREMIUM_MONTHLY];
    const annual = BILLING_CONFIG[BILLING_KEY_PREMIUM_ANNUAL];
    expect(monthly).toBeDefined();
    expect(annual).toBeDefined();

    // Narrow to the line-item subscription shape.
    if (!("lineItems" in monthly) || !("lineItems" in annual)) {
      throw new Error("expected line-item billing config");
    }
    expect(monthly.trialDays).toBe(7);
    expect(annual.trialDays).toBe(7);
    expect(monthly.lineItems[0]!.amount).toBeCloseTo(14.99);
    expect(annual.lineItems[0]!.amount).toBeCloseTo(149.9);
    expect(monthly.lineItems[0]!.interval).toBe("EVERY_30_DAYS");
    expect(annual.lineItems[0]!.interval).toBe("ANNUAL");
  });
});
