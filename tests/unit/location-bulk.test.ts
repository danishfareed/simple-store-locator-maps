import { describe, it, expect } from "vitest";
import { makeTestDb, seedShop } from "../helpers/db";
import {
  getLocationById,
  listLocations,
} from "../../app/repositories/location.repository.server";
import {
  bulkRemoveLocations,
  bulkSetLocationStatus,
  saveNewLocation,
} from "../../app/services/location.service.server";
import type { LocationInput } from "../../app/schemas/location.schema";

const SHOP = "bulk-test-shop";

const BASE_INPUT: LocationInput = {
  name: "Extra location",
  slug: "extra-location",
  status: "active",
};

describe("bulk location actions", () => {
  it("activates and deactivates only the selected, shop-scoped rows", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP); // seeds one active location: `${SHOP}-loc-1`
    const other = await saveNewLocation(db, SHOP, {
      ...BASE_INPUT,
      slug: "other-location",
      status: "inactive",
    });

    const changed = await bulkSetLocationStatus(db, SHOP, [`${SHOP}-loc-1`], "inactive");
    expect(changed).toBe(1);

    const seeded = await getLocationById(db, SHOP, `${SHOP}-loc-1`);
    expect(seeded?.status).toBe("inactive");

    // Untouched row keeps its original status.
    const untouched = await getLocationById(db, SHOP, other.id);
    expect(untouched?.status).toBe("inactive");
  });

  it("does not affect another shop's locations", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP);
    await seedShop(db, "other-shop");

    const changed = await bulkSetLocationStatus(
      db,
      SHOP,
      [`other-shop-loc-1`],
      "inactive",
    );
    expect(changed).toBe(0);

    const otherShopLoc = await getLocationById(db, "other-shop", "other-shop-loc-1");
    expect(otherShopLoc?.status).toBe("active");
  });

  it("bulk deletes only the selected, shop-scoped rows", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP);
    const extra = await saveNewLocation(db, SHOP, BASE_INPUT);

    const removed = await bulkRemoveLocations(db, SHOP, [extra.id]);
    expect(removed).toBe(1);

    const { items } = await listLocations(db, SHOP);
    expect(items.map((i) => i.id)).not.toContain(extra.id);
    expect(items.map((i) => i.id)).toContain(`${SHOP}-loc-1`);
  });

  it("returns 0 and changes nothing for an empty id list", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP);

    expect(await bulkSetLocationStatus(db, SHOP, [], "inactive")).toBe(0);
    expect(await bulkRemoveLocations(db, SHOP, [])).toBe(0);

    const { items } = await listLocations(db, SHOP);
    expect(items).toHaveLength(1);
  });
});

describe("location hours + coordinates round-trip", () => {
  it("persists hours and lat/lng through saveNewLocation and reload", async () => {
    const db = await makeTestDb();
    await seedShop(db, SHOP);

    const hours: LocationInput["hours"] = {
      "1": [{ open: "09:00", close: "17:00" }],
      "2": [{ open: "09:00", close: "17:00" }],
      "6": [{ open: "00:00", close: "00:00", closed: true }],
    };

    const created = await saveNewLocation(db, SHOP, {
      ...BASE_INPUT,
      slug: "hours-location",
      latitude: 40.7128,
      longitude: -74.006,
      hours,
    });

    const reloaded = await getLocationById(db, SHOP, created.id);
    expect(reloaded?.latitude).toBe(40.7128);
    expect(reloaded?.longitude).toBe(-74.006);
    expect(reloaded?.hours).toEqual(hours);
  });
});
