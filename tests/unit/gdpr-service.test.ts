import { describe, it, expect, vi } from "vitest";
import { makeTestDb, seedShop, countRows } from "../helpers/db";
import {
  purgeShopData,
  customerDataReport,
  redactCustomer,
} from "../../app/services/gdpr.service.server";

/** Minimal R2Bucket mock: list() returns fixed keys (not truncated) + a delete spy. */
function makeMockUploads(keys: string[]) {
  const list = vi.fn().mockResolvedValue({
    objects: keys.map((key) => ({ key })),
    truncated: false,
    delimitedPrefixes: [],
  });
  const del = vi.fn().mockResolvedValue(undefined);
  return { list, delete: del } as unknown as R2Bucket & {
    list: typeof list;
    delete: typeof del;
  };
}

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

  it("purgeShopData deletes the shop's R2 upload objects before purging import rows", async () => {
    const db = await makeTestDb();
    await seedShop(db, "s1");
    const keys = [
      "imports/s1/import-1/locations.csv",
      "imports/s1/import-2/locations.xlsx",
    ];
    const uploads = makeMockUploads(keys);

    await purgeShopData(db, "s1", uploads);

    expect(uploads.list).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "imports/s1/" }),
    );
    expect(uploads.delete).toHaveBeenCalledWith(keys);
    // DB rows are still purged as before.
    expect(await countRows(db, "shops", "s1")).toBe(0);
    expect(await countRows(db, "imports", "s1")).toBe(0);
  });

  it("purgeShopData pages through a truncated R2 listing until all objects are deleted", async () => {
    const db = await makeTestDb();
    await seedShop(db, "s1");

    const list = vi
      .fn()
      .mockResolvedValueOnce({
        objects: [{ key: "imports/s1/import-1/a.csv" }],
        truncated: true,
        cursor: "cursor-1",
        delimitedPrefixes: [],
      })
      .mockResolvedValueOnce({
        objects: [{ key: "imports/s1/import-2/b.csv" }],
        truncated: false,
        delimitedPrefixes: [],
      });
    const del = vi.fn().mockResolvedValue(undefined);
    const uploads = { list, delete: del } as unknown as R2Bucket;

    await purgeShopData(db, "s1", uploads);

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenNthCalledWith(1, expect.objectContaining({ prefix: "imports/s1/" }));
    expect(list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ prefix: "imports/s1/", cursor: "cursor-1" }),
    );
    expect(del).toHaveBeenCalledWith([
      "imports/s1/import-1/a.csv",
      "imports/s1/import-2/b.csv",
    ]);
  });

  it("purgeShopData skips R2 deletion (but still purges DB rows) when uploads is omitted", async () => {
    const db = await makeTestDb();
    await seedShop(db, "s1");
    await expect(purgeShopData(db, "s1")).resolves.toBeUndefined();
    expect(await countRows(db, "shops", "s1")).toBe(0);
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
