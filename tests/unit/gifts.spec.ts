import { describe, it, expect } from "vitest";
import { GIFT_BOXES, GIFT_CLOSED_VARIANTS } from "@/lib/constants/gifts";

describe("GIFT_BOXES", () => {
  it("every box has a positive shopCost and valid reward ranges", () => {
    for (const [id, box] of Object.entries(GIFT_BOXES)) {
      expect(box.shopCost, id).toBeGreaterThan(0);
      for (const [key, range] of Object.entries(box.rewards)) {
        if (!Array.isArray(range)) continue;
        const [lo, hi] = range as [number, number];
        void key;
        expect(lo, `${id}.${key} lo`).toBeLessThanOrEqual(hi);
        expect(lo, `${id}.${key} lo>=0`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("has a closed-variant image list for every box id", () => {
    for (const id of Object.keys(GIFT_BOXES)) {
      expect(GIFT_CLOSED_VARIANTS[id as keyof typeof GIFT_CLOSED_VARIANTS].length).toBeGreaterThan(0);
    }
  });
});
