import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db.server", () => ({
  sql: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  hasDatabase: () => false,
}));

const { taxMultiplierForRatio, zoneForRatio } = await import("@/lib/treasury.server");

describe("taxMultiplierForRatio", () => {
  it("is 1.0 at and above the green threshold (1.5)", () => {
    expect(taxMultiplierForRatio(1.5)).toBe(1.0);
    expect(taxMultiplierForRatio(2)).toBe(1.0);
  });

  it("interpolates linearly across the yellow zone", () => {
    expect(taxMultiplierForRatio(1.2)).toBeCloseTo(2.0);
    expect(taxMultiplierForRatio(1.35)).toBeCloseTo(1.75);
  });

  it("interpolates linearly across the red zone", () => {
    expect(taxMultiplierForRatio(1.0)).toBeCloseTo(4.0);
    expect(taxMultiplierForRatio(1.1)).toBeCloseTo(3.25);
  });

  it("is 5.0 below the critical threshold", () => {
    expect(taxMultiplierForRatio(0.99)).toBe(5.0);
    expect(taxMultiplierForRatio(0)).toBe(5.0);
  });

  it("returns 1 for non-finite ratios", () => {
    expect(taxMultiplierForRatio(NaN)).toBe(1);
    expect(taxMultiplierForRatio(Infinity)).toBe(1);
  });
});

describe("zoneForRatio", () => {
  it("classifies each zone boundary correctly", () => {
    expect(zoneForRatio(1.5)).toBe("green");
    expect(zoneForRatio(1.49)).toBe("yellow");
    expect(zoneForRatio(1.2)).toBe("yellow");
    expect(zoneForRatio(1.19)).toBe("red");
    expect(zoneForRatio(1.0)).toBe("red");
    expect(zoneForRatio(0.99)).toBe("critical");
  });
});
