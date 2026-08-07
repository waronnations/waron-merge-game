import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, assertRateLimit, assertMergeRate } from "@/lib/rate-limit.server";

describe("checkRateLimit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows requests under the limit", () => {
    const key = `test-${Math.random()}`;
    expect(checkRateLimit(key, 3, 1000)).toBe(true);
    expect(checkRateLimit(key, 3, 1000)).toBe(true);
    expect(checkRateLimit(key, 3, 1000)).toBe(true);
  });

  it("blocks once the limit is reached within the window", () => {
    const key = `test-${Math.random()}`;
    checkRateLimit(key, 2, 1000);
    checkRateLimit(key, 2, 1000);
    expect(checkRateLimit(key, 2, 1000)).toBe(false);
  });

  it("allows again after the window expires", () => {
    const key = `test-${Math.random()}`;
    checkRateLimit(key, 1, 1000);
    expect(checkRateLimit(key, 1, 1000)).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(checkRateLimit(key, 1, 1000)).toBe(true);
  });
});

describe("assertRateLimit", () => {
  it("throws when over the limit", () => {
    const key = `assert-${Math.random()}`;
    assertRateLimit(key, 1, 1000);
    expect(() => assertRateLimit(key, 1, 1000)).toThrow("rate_limited");
  });
});

describe("assertMergeRate", () => {
  it("allows up to 12 merges per 10s per user", () => {
    const userId = `user-${Math.random()}`;
    for (let i = 0; i < 12; i++) {
      expect(() => assertMergeRate(userId)).not.toThrow();
    }
    expect(() => assertMergeRate(userId)).toThrow();
  });
});
