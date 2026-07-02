import { describe, it, expect } from "vitest";
import {
  IMPORT_COLUMN_ALIASES,
  ImportRowSchema,
  ImportUploadSchema,
} from "../../app/schemas/import.schema";

describe("ImportUploadSchema", () => {
  it("accepts a CSV under the size limit", () => {
    expect(
      ImportUploadSchema.safeParse({
        filename: "file.csv",
        sizeBytes: 1024,
        contentType: "text/csv",
      }).success,
    ).toBe(true);
  });

  it("rejects an unsupported extension", () => {
    expect(
      ImportUploadSchema.safeParse({
        filename: "file.txt",
        sizeBytes: 1024,
        contentType: "text/csv",
      }).success,
    ).toBe(false);
  });

  it("rejects an oversized file", () => {
    expect(
      ImportUploadSchema.safeParse({
        filename: "file.csv",
        sizeBytes: 999_999_999,
        contentType: "text/csv",
      }).success,
    ).toBe(false);
  });
});

describe("ImportRowSchema", () => {
  it("accepts a minimal row", () => {
    expect(ImportRowSchema.safeParse({ name: "Store" }).success).toBe(true);
  });

  it("coerces lat/lng from strings", () => {
    const out = ImportRowSchema.parse({
      name: "Store",
      latitude: "51.5",
      longitude: "-0.1",
    });
    expect(out.latitude).toBeCloseTo(51.5);
    expect(out.longitude).toBeCloseTo(-0.1);
  });

  it("exposes expected aliases", () => {
    expect(IMPORT_COLUMN_ALIASES.zip).toBe("postal_code");
    expect(IMPORT_COLUMN_ALIASES.street).toBe("address_line1");
    expect(IMPORT_COLUMN_ALIASES.lat).toBe("latitude");
  });

  // defect #3: empty lat/lng must NOT coerce to 0 ("Null Island")
  it("treats blank latitude/longitude as undefined (not 0)", () => {
    const out = ImportRowSchema.parse({
      name: "Store",
      latitude: "",
      longitude: "",
    });
    expect(out.latitude).toBeUndefined();
    expect(out.longitude).toBeUndefined();
  });

  it("treats whitespace-only latitude/longitude as undefined", () => {
    const out = ImportRowSchema.parse({
      name: "Store",
      latitude: "  ",
      longitude: "  ",
    });
    expect(out.latitude).toBeUndefined();
    expect(out.longitude).toBeUndefined();
  });

  it("still coerces and validates a real lat/lng", () => {
    const out = ImportRowSchema.parse({
      name: "Store",
      latitude: "51.5",
      longitude: "-0.1",
    });
    expect(out.latitude).toBeCloseTo(51.5);
    expect(out.longitude).toBeCloseTo(-0.1);
    expect(ImportRowSchema.safeParse({ name: "S", latitude: "999" }).success).toBe(
      false,
    );
  });
});
