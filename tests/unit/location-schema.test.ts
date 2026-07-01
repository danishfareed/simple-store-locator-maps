import { describe, it, expect } from "vitest";
import { LocationInputSchema } from "../../app/schemas/location.schema";

describe("LocationInputSchema", () => {
  it("accepts a minimal valid payload", () => {
    const out = LocationInputSchema.safeParse({ name: "A", slug: "a" });
    expect(out.success).toBe(true);
  });

  it("rejects a bad slug format", () => {
    const out = LocationInputSchema.safeParse({ name: "A", slug: "Bad Slug!" });
    expect(out.success).toBe(false);
  });

  it("uppercases the country code", () => {
    const out = LocationInputSchema.parse({
      name: "A",
      slug: "a",
      countryCode: "gb",
    });
    expect(out.countryCode).toBe("GB");
  });

  it("clamps latitude range", () => {
    const out = LocationInputSchema.safeParse({
      name: "A",
      slug: "a",
      latitude: 200,
    });
    expect(out.success).toBe(false);
  });
});
