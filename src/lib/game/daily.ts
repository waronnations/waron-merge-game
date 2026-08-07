// src/lib/game/daily.ts
// Pure daily-bonus / task / quest claim logic extracted from the useGame hook.
import { MAX_ENERGY } from "@/lib/constants";
import {
  evaluateAchievements,
  applyAchievementRewards,
} from "@/lib/achievements";
import type { GameState } from "./types";
import { truncateToDay, updateTaskProgress } from "./helpers";

/** Result of the offline (unauthenticated) daily-bonus claim. */
export type DailyClaimResult = {
  glory: number;
  energy: number;
  streak: number;
} | null;

export function claimDailyState(
  s: GameState,
): { nextState: GameState; result: DailyClaimResult } | null {
  const today = truncateToDay(Date.now());
  if (s.lastDailyClaim === today) return null;

  const yesterday = today - 86_400_000;
  const streak = s.lastDailyClaim === yesterday ? s.dailyStreak + 1 : 1;

  const glory = 100 + streak * 25;
  const energy = 30;

  let next: GameState = {
    ...s,
    glory: s.glory + glory,
    energy: Math.min(MAX_ENERGY, s.energy + energy),
    lastDailyClaim: today,
    dailyStreak: streak,
    lastSeenAt: Date.now(),
  };
  next = updateTaskProgress(next);

  const unlocked = evaluateAchievements(next, {});
  next = applyAchievementRewards(next, unlocked);

  return { nextState: next, result: { glory, energy, streak } };
}

export function canClaimDailyPure(s: GameState): boolean {
  return s.lastDailyClaim !== truncateToDay(Date.now());
}

export function claimTaskState(
  s: GameState,
  id: string,
): { ok: true; nextState: GameState } | { ok: false; reason: string } {
  const task = s.tasks.find((t) => t.id === id);
  if (!task || !task.done || task.claimed) {
    return { ok: false, reason: "already_claimed" };
  }
  const tasks = s.tasks.map((t) =>
    t.id === id ? { ...t, claimed: true } : t,
  );
  const nextState: GameState = {
    ...s,
    tasks,
    glory: s.glory + task.reward,
    wardogTokens: s.wardogTokens + (task.wardog ?? 0),
    warcatTokens: s.warcatTokens + (task.warcat ?? 0),
    lastSeenAt: Date.now(),
  };
  return { ok: true, nextState };
}

export function claimDailyQuestState(
  s: GameState,
  id: string,
): { ok: true; nextState: GameState } | { ok: false; reason: string } {
  const q = s.dailyQuests.find((x) => x.id === id);
  if (!q || q.progress < q.target || q.claimed) {
    return { ok: false, reason: "already_claimed" };
  }
  const dailyQuests = s.dailyQuests.map((x) =>
    x.id === id ? { ...x, claimed: true } : x,
  );
  const nextState: GameState = {
    ...s,
    dailyQuests,
    glory: s.glory + q.reward,
    wardogTokens: s.wardogTokens + (q.wardog ?? 0),
    warcatTokens: s.warcatTokens + (q.warcat ?? 0),
    energy: Math.min(MAX_ENERGY, s.energy + (q.energy ?? 0)),
    lastSeenAt: Date.now(),
  };
  return { ok: true, nextState };
}

/** Rolls the daily quest set over when the UTC day changes. */
export function refreshDailyQuestsIfNeeded(
  s: GameState,
  pickDailyQuests: (seed: number) => GameState["dailyQuests"],
): GameState | null {
  const today = truncateToDay(Date.now());
  if (s.dailyQuestsDate === today) return null;
  return {
    ...s,
    dailyQuests: pickDailyQuests(today),
    dailyQuestsDate: today,
  };
}
