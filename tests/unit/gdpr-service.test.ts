import { describe, it, expect } from "vitest";
import { makeTestDb, seedShop, countRows } from "../helpers/db";
import {
  purgeShopData,
  customerDataReport,
  redactCustomer,
} from "../../app/services/gdpr.service.server";

describe("gdpr.service", () => {
  it("purgeShopData removes all rows for the shop", async () => {
    const db = await makeTestDb();
    await seedShop(db, "s1"); // inserts shop + a location + a widget + analytics row
    await purgeShopData(db, "s1");
    expect(await countRows(db, "shops", "s1")).toBe(0);
    expect(await countRows(db, "locations", "s1")).toBe(0);
    expect(await countRows(db, "widgets", "s1")).toBe(0);
    expect(await countRows(db, "analytics_events", "s1")).toBe(0);
  });

  it("purgeShopData does not affect other shops' data", async () => {
    const db = await makeTestDb();
    await seedShop(db, "s1");
    await seedShop(db, "s2");
    await purgeShopData(db, "s1");
    expect(await countRows(db, "shops", "s1")).toBe(0);
    expect(await countRows(db, "shops", "s2")).toBe(1);
    expect(await countRows(db, "locations", "s2")).toBe(1);
    expect(await countRows(db, "widgets", "s2")).toBe(1);
    expect(await countRows(db, "analytics_events", "s2")).toBe(1);
  });

  it("customerDataReport lists held categories", async () => {
    const db = await makeTestDb();
    await seedShop(db, "s1");
    const r = await customerDataReport(db, "s1", "cust-1");
    expect(Array.isArray(r.heldData)).toBe(true);
    expect(r.heldData.length).toBeGreaterThan(0);
    expect(r.heldData[0]).toContain("No customer PII stored");
  });

  it("redactCustomer resolves without throwing when no customer-linked rows exist", async () => {
    const db = await makeTestDb();
    await seedShop(db, "s1");
    await expect(redactCustomer(db, "s1", "cust-1")).resolves.toBeUndefined();
    // Shop data itself is untouched by a customer redact.
    expect(await countRows(db, "shops", "s1")).toBe(1);
  });
});
