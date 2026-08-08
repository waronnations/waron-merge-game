import { describe, it, expect, vi, afterEach } from "vitest";
import { claimDailyState, canClaimDailyPure, claimTaskState, claimDailyQuestState } from "@/lib/game/daily";
import { initialState, truncateToDay } from "@/lib/game/helpers";
import { MAX_ENERGY } from "@/lib/constants";
import type { GameState } from "@/lib/game/types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...initialState(), board: Array(36).fill(null), ...overrides };
}

afterEach(() => vi.useRealTimers());

describe("canClaimDailyPure / claimDailyState", () => {
  it("allows claim when never claimed before", () => {
    const s = baseState({ lastDailyClaim: 0 });
    expect(canClaimDailyPure(s)).toBe(true);
    const out = claimDailyState(s);
    expect(out).not.toBeNull();
    expect(out!.result?.streak).toBe(1);
  });

  it("blocks a second claim on the same UTC day", () => {
    const today = truncateToDay(Date.now());
    const s = baseState({ lastDailyClaim: today });
    expect(canClaimDailyPure(s)).toBe(false);
    expect(claimDailyState(s)).toBeNull();
  });

  it("increments streak for consecutive days, resets otherwise", () => {
    const today = truncateToDay(Date.now());
    const yesterday = today - 86_400_000;
    const consecutive = baseState({ lastDailyClaim: yesterday, dailyStreak: 3 });
    const out1 = claimDailyState(consecutive);
    expect(out1!.result?.streak).toBe(4);

    const twoDaysAgo = today - 2 * 86_400_000;
    const broken = baseState({ lastDailyClaim: twoDaysAgo, dailyStreak: 3 });
    const out2 = claimDailyState(broken);
    expect(out2!.result?.streak).toBe(1);
  });

  it("caps energy gain at MAX_ENERGY", () => {
    const s = baseState({ lastDailyClaim: 0, energy: MAX_ENERGY - 5 });
    const out = claimDailyState(s);
    expect(out!.nextState.energy).toBe(MAX_ENERGY);
  });
});

describe("claimTaskState", () => {
  it("fails if the task is not done", () => {
    const s = baseState();
    const out = claimTaskState(s, "merge10");
    expect(out.ok).toBe(false);
  });

  it("claims a completed task and grants rewards", () => {
    const s = baseState();
    s.tasks = s.tasks.map((t) => (t.id === "merge10" ? { ...t, done: true } : t));
    const out = claimTaskState(s, "merge10");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.nextState.glory).toBe(s.glory + 100);
      expect(out.nextState.tasks.find((t) => t.id === "merge10")?.claimed).toBe(true);
    }
  });
});

describe("claimDailyQuestState", () => {
  it("fails when progress has not reached target", () => {
    const s = baseState();
    const questId = s.dailyQuests[0].id;
    const out = claimDailyQuestState(s, questId);
    expect(out.ok).toBe(false);
  });

  it("claims a completed quest and grants rewards", () => {
    const s = baseState();
    const quest = s.dailyQuests[0];
    s.dailyQuests = s.dailyQuests.map((q) =>
      q.id === quest.id ? { ...q, progress: q.target } : q,
    );
    const out = claimDailyQuestState(s, quest.id);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.nextState.glory).toBe(s.glory + quest.reward);
    }
  });
});
