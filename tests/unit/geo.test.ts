import { describe, it, expect } from "vitest";
import { bboxForRadius, haversineKm } from "../../app/lib/utils/geo";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm({ lat: 51.5, lng: -0.1 }, { lat: 51.5, lng: -0.1 })).toBe(0);
  });

  it("approximates London ↔ Paris at ~344km", () => {
    const d = haversineKm(
      { lat: 51.5074, lng: -0.1278 },
      { lat: 48.8566, lng: 2.3522 },
    );
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(350);
  });
});

describe("bboxForRadius", () => {
  it("widens the longitude range near the equator less than near the poles", () => {
    const equator = bboxForRadius({ lat: 0, lng: 0 }, 50);
    const highLat = bboxForRadius({ lat: 60, lng: 0 }, 50);
    const equatorWidth = equator.maxLng - equator.minLng;
    const polarWidth = highLat.maxLng - highLat.minLng;
    expect(polarWidth).toBeGreaterThan(equatorWidth);
  });
});
