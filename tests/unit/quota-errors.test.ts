import { describe, it, expect } from "vitest";
import { QuotaExceededError } from "../../app/services/quota.service.server";

describe("QuotaExceededError", () => {
  it("includes the kind, plan, cap, and current count in its message", () => {
    const err = new QuotaExceededError("locations", "free", 5, 5);
    expect(err.name).toBe("QuotaExceededError");
    expect(err.message).toContain("locations");
    expect(err.message).toContain("free");
    expect(err.message).toContain("5/5");
  });
});
