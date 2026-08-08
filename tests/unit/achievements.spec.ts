import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  applyAchievementRewards,
  achievementTitle,
} from "@/lib/achievements";
import { initialState } from "@/lib/game/helpers";
import type { GameState } from "@/lib/game/types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...initialState(), board: Array(36).fill(null), ...overrides };
}

describe("ACHIEVEMENTS", () => {
  it("has unique ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("evaluateAchievements", () => {
  it("unlocks first_merge once totalMerges >= 1", () => {
    const s = baseState({ totalMerges: 1 });
    expect(evaluateAchievements(s)).toContain("first_merge");
  });

  it("does not re-unlock already-owned achievements", () => {
    const s = baseState({ totalMerges: 1, achievements: ["first_merge"] });
    expect(evaluateAchievements(s)).not.toContain("first_merge");
  });

  it("unlocks combo_5 only when combo context reaches threshold", () => {
    const s = baseState();
    expect(evaluateAchievements(s, { combo: 4 })).not.toContain("combo_5");
    expect(evaluateAchievements(s, { combo: 5 })).toContain("combo_5");
  });
});

describe("applyAchievementRewards", () => {
  it("adds glory/token rewards and records ids", () => {
    const s = baseState();
    const next = applyAchievementRewards(s, ["first_merge"]);
    expect(next.glory).toBe(s.glory + 50);
    expect(next.achievements).toContain("first_merge");
  });

  it("is a no-op for empty ids", () => {
    const s = baseState();
    expect(applyAchievementRewards(s, [])).toBe(s);
  });

  it("skips ids already unlocked", () => {
    const s = baseState({ achievements: ["first_merge"] });
    const next = applyAchievementRewards(s, ["first_merge"]);
    expect(next).toBe(s);
  });
});

describe("achievementTitle", () => {
  it("resolves a known id to its title", () => {
    expect(achievementTitle("first_merge")).toBe("First Blood");
  });
  it("falls back to the id itself when unknown", () => {
    expect(achievementTitle("nope")).toBe("nope");
  });
});
