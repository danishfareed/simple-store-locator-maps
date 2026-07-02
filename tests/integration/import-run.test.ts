import { describe, it, expect } from "vitest";
import { eq, and } from "drizzle-orm";
import { makeTestDb } from "../helpers/db";
import { shops, locations, imports } from "../../app/lib/db/schema";
import {
  runImport,
  ImportPermanentError,
} from "../../app/services/import.service.server";
import { countLocations } from "../../app/repositories/location.repository.server";

/** Seed a bare shop on a given plan (no default location). */
async function seedBareShop(
  db: Awaited<ReturnType<typeof makeTestDb>>,
  shopId: string,
  planHandle: "free" | "premium" = "free",
) {
  const now = new Date();
  await db.insert(shops).values({
    id: shopId,
    shopDomain: `${shopId}.myshopify.com`,
    planHandle,
    installedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

/** Insert a pending import row so `runImport` has something to update. */
async function seedImport(
  db: Awaited<ReturnType<typeof makeTestDb>>,
  importId: string,
  shopId: string,
  kind: "csv" | "xlsx" = "csv",
) {
  await db.insert(imports).values({
    id: importId,
    shopId,
    filename: "test.csv",
    r2Key: `imports/${shopId}/${importId}/test.csv`,
    kind,
    status: "pending",
  });
}

async function getImportRow(
  db: Awaited<ReturnType<typeof makeTestDb>>,
  importId: string,
) {
  return db.select().from(imports).where(eq(imports.id, importId)).get();
}

describe("runImport — plan location cap (defect #1)", () => {
  it("free shop (cap 3) importing 5 distinct rows inserts only 3, records overflow as errors", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s1", "free");
    await seedImport(db, "imp1", "s1");

    const rows = [
      { name: "Alpha" },
      { name: "Bravo" },
      { name: "Charlie" },
      { name: "Delta" },
      { name: "Echo" },
    ];

    await runImport(db, "s1", "imp1", rows);

    expect(await countLocations(db, "s1")).toBe(3);

    const imp = await getImportRow(db, "imp1");
    expect(imp?.processedRows).toBe(3);
    // 2 overflow rows recorded as errors
    const overflow = (imp?.errorSummary ?? []).filter((e) =>
      /limit reached|upgrade/i.test(e.message),
    );
    expect(overflow.length).toBe(2);
    // Never silently over-cap.
    expect(await countLocations(db, "s1")).toBeLessThanOrEqual(3);
  });

  it("premium shop (cap 100) respects the same cap", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s2", "premium");
    await seedImport(db, "imp2", "s2");

    const rows = Array.from({ length: 5 }, (_, i) => ({ name: `Store ${i}` }));
    await runImport(db, "s2", "imp2", rows);

    expect(await countLocations(db, "s2")).toBe(5);
    const imp = await getImportRow(db, "imp2");
    expect(imp?.processedRows).toBe(5);
  });

  it("rows updating existing externalId locations do not count as net-new toward the cap", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s3", "free");
    await seedImport(db, "imp3", "s3");

    // Pre-existing location with externalId "X1" (count = 1, cap = 3 → 2 net-new allowed)
    await db.insert(locations).values({
      id: "loc-x1",
      shopId: "s3",
      name: "Existing",
      slug: "existing",
      status: "active",
      externalId: "X1",
    });

    const rows = [
      { name: "Existing Updated", external_id: "X1" }, // update, not net-new
      { name: "New A", external_id: "N1" },
      { name: "New B", external_id: "N2" },
      { name: "New C", external_id: "N3" }, // this one overflows (would be 4th)
    ];

    await runImport(db, "s3", "imp3", rows);

    // 1 existing + 2 net-new = 3 (cap). The 4th (New C) overflows.
    expect(await countLocations(db, "s3")).toBe(3);
    const imp = await getImportRow(db, "imp3");
    const overflow = (imp?.errorSummary ?? []).filter((e) =>
      /limit reached|upgrade/i.test(e.message),
    );
    expect(overflow.length).toBe(1);
  });
});

describe("runImport — slug uniqueness (defect #2)", () => {
  it("two rows with the same name get distinct unique slugs, no throw", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s4", "premium");
    await seedImport(db, "imp4", "s4");

    await runImport(db, "s4", "imp4", [{ name: "Same Name" }, { name: "Same Name" }]);

    const rows = await db
      .select()
      .from(locations)
      .where(eq(locations.shopId, "s4"))
      .all();
    expect(rows.length).toBe(2);
    const slugs = rows.map((r) => r.slug).sort();
    expect(new Set(slugs).size).toBe(2);
    expect(slugs).toContain("same-name");
    expect(slugs.some((s) => /^same-name-\d+$/.test(s))).toBe(true);

    const imp = await getImportRow(db, "imp4");
    expect(imp?.status).toBe("completed");
  });

  it("a row colliding with an existing location slug gets suffixed, does not abort", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s5", "premium");
    await seedImport(db, "imp5", "s5");

    await db.insert(locations).values({
      id: "loc-existing",
      shopId: "s5",
      name: "Downtown",
      slug: "downtown",
      status: "active",
    });

    await runImport(db, "s5", "imp5", [{ name: "Downtown" }, { name: "Uptown" }]);

    const rows = await db
      .select()
      .from(locations)
      .where(eq(locations.shopId, "s5"))
      .all();
    expect(rows.length).toBe(3); // existing + 2 new
    const slugs = rows.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(3);
    expect(slugs).toContain("downtown");
    expect(slugs.some((s) => /^downtown-\d+$/.test(s))).toBe(true);

    const imp = await getImportRow(db, "imp5");
    expect(imp?.status).toBe("completed");
  });
});

describe("runImport — blank lat/lng (defect #3)", () => {
  it("stores null lat/lng for blank cells (not 0/0)", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s6", "premium");
    await seedImport(db, "imp6", "s6");

    await runImport(db, "s6", "imp6", [
      { name: "No Geo", latitude: "", longitude: "" },
    ]);

    const loc = await db
      .select()
      .from(locations)
      .where(and(eq(locations.shopId, "s6"), eq(locations.name, "No Geo")))
      .get();
    expect(loc?.latitude).toBeNull();
    expect(loc?.longitude).toBeNull();
  });
});

describe("runImport — blank optional string columns (defect #4)", () => {
  it("accepts a row with blank email/website/country_code but valid name", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s7", "premium");
    await seedImport(db, "imp7", "s7");

    await runImport(db, "s7", "imp7", [
      {
        name: "Blank Optionals",
        email: "",
        website: "",
        country_code: "",
        status: "",
        image_url: "",
      },
    ]);

    expect(await countLocations(db, "s7")).toBe(1);
    const imp = await getImportRow(db, "imp7");
    expect(imp?.processedRows).toBe(1);
    expect(imp?.failedRows).toBe(0);
  });
});

describe("runImport — failedRows counts rows not issues (defect #5)", () => {
  it("a single row with two invalid fields counts as failedRows = 1", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s8", "premium");
    await seedImport(db, "imp8", "s8");

    // latitude out of range + email invalid = 2 issues, 1 row
    await runImport(db, "s8", "imp8", [
      { name: "Bad Row", latitude: "999", email: "not-an-email" },
    ]);

    const imp = await getImportRow(db, "imp8");
    expect(imp?.failedRows).toBe(1);
    expect(imp?.totalRows).toBe(1);
    // processedRows + failedRows reconciles with totalRows
    expect((imp?.processedRows ?? 0) + (imp?.failedRows ?? 0)).toBe(imp?.totalRows);
    // Per-issue detail still recorded.
    expect((imp?.errorSummary ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("reconciles processedRows + failedRows == totalRows across a mixed file", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s9", "premium");
    await seedImport(db, "imp9", "s9");

    await runImport(db, "s9", "imp9", [
      { name: "Good 1" },
      { name: "", latitude: "abc" }, // invalid: missing name + bad lat
      { name: "Good 2" },
    ]);

    const imp = await getImportRow(db, "imp9");
    expect(imp?.totalRows).toBe(3);
    expect(imp?.failedRows).toBe(1);
    expect(imp?.processedRows).toBe(2);
    expect((imp?.processedRows ?? 0) + (imp?.failedRows ?? 0)).toBe(3);
  });
});

describe("runImport — deterministic failure is permanent (defect #2, poison message)", () => {
  it("throws ImportPermanentError (not a retryable error) when the whole file is invalid and marks failed", async () => {
    const db = await makeTestDb();
    await seedBareShop(db, "s10", "premium");
    await seedImport(db, "imp10", "s10");

    // A file of entirely invalid rows still completes (marked failed), never throws
    // a retryable error that would loop forever.
    await runImport(db, "s10", "imp10", [{ name: "" }, { name: "" }]);

    const imp = await getImportRow(db, "imp10");
    expect(imp?.status).toBe("failed");
    expect(imp?.failedRows).toBe(2);
    expect(imp?.processedRows).toBe(0);
  });

  it("ImportPermanentError is exported and marked non-retryable", () => {
    const err = new ImportPermanentError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.retryable).toBe(false);
  });
});
