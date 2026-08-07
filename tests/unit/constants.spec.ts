import { describe, it, expect } from "vitest";
import * as constants from "@/lib/constants";

describe("constants barrel", () => {
  it("exports no NaN numeric values", () => {
    for (const [key, value] of Object.entries(constants)) {
      if (typeof value === "number") {
        expect(Number.isNaN(value), `${key} should not be NaN`).toBe(false);
      }
    }
  });

  it("MAX_ENERGY / BOARD_SIZE / MAX_TIER are sane positive numbers", () => {
    expect(constants.MAX_ENERGY).toBeGreaterThan(0);
    expect(constants.BOARD_SIZE).toBeGreaterThan(0);
    expect(constants.MAX_TIER).toBeGreaterThan(0);
  });
});
