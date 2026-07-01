import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedShop } from "../helpers/db";
import { shops } from "../../app/lib/db/schema";
import { getSettings, saveSettings } from "../../app/services/settings.service.server";

const SHOP = "settings-test-shop";

describe("getSettings", () => {
  it("returns {} for a shop that has never saved settings", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP);
    expect(await getSettings(db, SHOP)).toEqual({});
  });
});

describe("saveSettings", () => {
  it("validates, persists, and round-trips a full settings payload", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP);
    await db.update(shops).set({ planHandle: "premium" }).where(eq(shops.id, SHOP));

    const saved = await saveSettings(db, SHOP, {
      mapProvider: "google",
      googleMapsApiKey: "abc123",
      defaultLatitude: 40.7128,
      defaultLongitude: -74.006,
      defaultZoom: 12,
      unitSystem: "imperial",
      branding: { primaryColor: "#112233", logoUrl: "https://example.com/logo.png" },
      osmGeocoderUrl: "https://nominatim.example.com",
    });

    expect(saved.mapProvider).toBe("google");
    expect(saved.branding).toEqual({
      primaryColor: "#112233",
      logoUrl: "https://example.com/logo.png",
    });

    const reloaded = await getSettings(db, SHOP);
    expect(reloaded).toEqual(saved);
  });

  it("merges a partial save into existing settings instead of clobbering it", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP);

    await saveSettings(db, SHOP, {
      unitSystem: "imperial",
      branding: { primaryColor: "#112233" },
    });

    const after = await saveSettings(db, SHOP, { defaultZoom: 14 });

    expect(after.unitSystem).toBe("imperial");
    expect(after.branding).toEqual({ primaryColor: "#112233" });
    expect(after.defaultZoom).toBe(14);
  });

  it("rejects an invalid payload", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP);
    await expect(
      saveSettings(db, SHOP, { defaultLatitude: 999 } as never),
    ).rejects.toThrow();
  });

  it("clamps mapProvider back to leaflet for a free-plan shop", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP); // seeded on the "free" plan

    const saved = await saveSettings(db, SHOP, { mapProvider: "google" });
    expect(saved.mapProvider).toBe("leaflet");

    const reloaded = await getSettings(db, SHOP);
    expect(reloaded.mapProvider).toBe("leaflet");
  });

  it("allows mapProvider=google for a premium-plan shop", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP);
    await db.update(shops).set({ planHandle: "premium" }).where(eq(shops.id, SHOP));

    const saved = await saveSettings(db, SHOP, { mapProvider: "google" });
    expect(saved.mapProvider).toBe("google");
  });
});
