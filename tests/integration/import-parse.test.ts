import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import {
  IMPORT_COLUMN_ALIASES,
  ImportRowSchema,
} from "../../app/schemas/import.schema";

function normaliseHeader(header: string): string {
  const h = header.trim().toLowerCase().replace(/\s+/g, "_");
  return IMPORT_COLUMN_ALIASES[h] ?? h;
}

describe("import CSV parse & alias normalisation", () => {
  it("maps zip/postcode/state/country aliases onto canonical names", () => {
    const csv = [
      "Title,Street,City,Province,Postcode,Country",
      "Flagship,221B Baker Street,London,Greater London,NW1 6XE,gb",
    ].join("\n");

    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normaliseHeader,
    });

    expect(parsed.data[0]).toMatchObject({
      name: "Flagship",
      address_line1: "221B Baker Street",
      city: "London",
      region: "Greater London",
      postal_code: "NW1 6XE",
      country_code: "gb",
    });

    const row = ImportRowSchema.parse(parsed.data[0]);
    expect(row.name).toBe("Flagship");
    expect(row.country_code).toBe("gb");
  });

  it("coerces numeric lat/lng from CSV strings", () => {
    const csv = "name,lat,lng\nStore A,51.5074,-0.1278";
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normaliseHeader,
    });
    const row = ImportRowSchema.parse(parsed.data[0]);
    expect(row.latitude).toBeCloseTo(51.5074);
    expect(row.longitude).toBeCloseTo(-0.1278);
  });

  it("rejects an out-of-range lat", () => {
    const csv = "name,lat,lng\nBad,200,0";
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normaliseHeader,
    });
    expect(ImportRowSchema.safeParse(parsed.data[0]).success).toBe(false);
  });
});
