import { describe, it, expect } from "vitest";
import { SettingsSchema } from "../../app/schemas/settings.schema";

describe("SettingsSchema", () => {
  it("accepts a minimal valid payload (all fields optional)", () => {
    const r = SettingsSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts a fully populated valid payload", () => {
    const r = SettingsSchema.safeParse({
      mapProvider: "google",
      googleMapsApiKey: "abc123",
      defaultLatitude: 40.7128,
      defaultLongitude: -74.006,
      defaultZoom: 12,
      unitSystem: "imperial",
      branding: { primaryColor: "#112233", logoUrl: "https://example.com/logo.png" },
      osmGeocoderUrl: "https://nominatim.example.com",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a bad hex color in branding.primaryColor", () => {
    const r = SettingsSchema.safeParse({
      branding: { primaryColor: "not-a-color" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an out-of-range latitude", () => {
    const r = SettingsSchema.safeParse({ defaultLatitude: 200 });
    expect(r.success).toBe(false);
  });

  it("rejects an out-of-range longitude", () => {
    const r = SettingsSchema.safeParse({ defaultLongitude: -200 });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid mapProvider value", () => {
    const r = SettingsSchema.safeParse({ mapProvider: "bing" });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid unitSystem value", () => {
    const r = SettingsSchema.safeParse({ unitSystem: "furlongs" });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed osmGeocoderUrl", () => {
    const r = SettingsSchema.safeParse({ osmGeocoderUrl: "not-a-url" });
    expect(r.success).toBe(false);
  });

  it("rejects an out-of-range defaultZoom", () => {
    const r = SettingsSchema.safeParse({ defaultZoom: 25 });
    expect(r.success).toBe(false);
  });
});
