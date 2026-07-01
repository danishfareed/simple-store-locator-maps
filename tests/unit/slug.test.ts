import { describe, it, expect } from "vitest";
import { slugify } from "../../app/lib/utils/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips accents", () => {
    expect(slugify("Café Noël")).toBe("cafe-noel");
  });

  it("collapses repeat separators", () => {
    expect(slugify("  foo   bar !!! baz ")).toBe("foo-bar-baz");
  });

  it("returns empty string for unsluggable input", () => {
    expect(slugify("!!!")).toBe("");
  });
});
