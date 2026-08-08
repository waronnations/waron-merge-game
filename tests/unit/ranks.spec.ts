import { describe, it, expect } from "vitest";
import { getRank, getLevel, getRankForGlory, RANKS } from "@/lib/ranks";

describe("RANKS table", () => {
  it("is sorted ascending by minGlory starting at 0", () => {
    expect(RANKS[0].minGlory).toBe(0);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minGlory).toBeGreaterThan(RANKS[i - 1].minGlory);
    }
  });
});

describe("getRank", () => {
  it("returns Recruit at 0 glory", () => {
    const { rank, index } = getRank(0);
    expect(rank.name).toBe("Recruit");
    expect(index).toBe(0);
  });

  it("returns the top rank when glory exceeds all thresholds", () => {
    const { rank, next } = getRank(10_000_000);
    expect(rank.name).toBe("Warlord");
    expect(next).toBeNull();
  });

  it("computes progress toward the next rank", () => {
    const { progress, next } = getRank(125); // halfway to Private (250)
    expect(next?.name).toBe("Private");
    expect(progress).toBeCloseTo(0.5);
  });
});

describe("getLevel", () => {
  it("is 1 at zero glory", () => {
    expect(getLevel(0)).toBe(1);
  });
  it("increases monotonically with glory", () => {
    expect(getLevel(10_000)).toBeGreaterThan(getLevel(100));
  });
});

describe("getRankForGlory", () => {
  it("matches getRank().rank", () => {
    expect(getRankForGlory(5000).name).toBe(getRank(5000).rank.name);
  });
});
