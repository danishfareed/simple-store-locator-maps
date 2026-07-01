import { describe, it, expect } from "vitest";
import { directionsUrl } from "../../app/lib/utils/directions";

describe("directionsUrl", () => {
  it("builds a Google Maps directions URL", () => {
    const url = directionsUrl({ lat: 51.5074, lng: -0.1278 }, "google");
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=51.5074,-0.1278",
    );
  });

  it("builds an Apple Maps directions URL", () => {
    const url = directionsUrl({ lat: 40.7128, lng: -74.006 }, "apple");
    expect(url).toBe("https://maps.apple.com/?daddr=40.7128,-74.006");
  });

  it("handles negative + fractional coordinates for both providers", () => {
    const loc = { lat: -33.8688, lng: 151.2093 };
    expect(directionsUrl(loc, "google")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-33.8688,151.2093",
    );
    expect(directionsUrl(loc, "apple")).toBe(
      "https://maps.apple.com/?daddr=-33.8688,151.2093",
    );
  });
});
