import { describe, it, expect } from "vitest";
import { PROVIDERS, resolveProvider } from "../../app/services/provider.service.server";

describe("resolveProvider", () => {
  it("always permits Leaflet", () => {
    const p = resolveProvider("leaflet", { hasApiKey: false });
    expect(p.id).toBe("leaflet");
  });

  it("falls back to Leaflet when Google is requested without a key", () => {
    const p = resolveProvider("google", { hasApiKey: false });
    expect(p.id).toBe("leaflet");
  });

  it("permits Google when a key is present", () => {
    const p = resolveProvider("google", { hasApiKey: true });
    expect(p.id).toBe("google");
  });

  it("exposes every registered provider via PROVIDERS", () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(["google", "leaflet"]);
  });
});
