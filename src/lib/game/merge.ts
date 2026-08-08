// src/lib/game/merge.ts
import { MAX_TIER, cellVariant } from "@/lib/units";
import {
  ENERGY_PER_MERGE,
  EXPLOSION_SHROOM_COLORS,
  VARIANT_PERFECT_MULT,
  getComboMultiplier,
} from "@/lib/constants";
import { getActiveEvents, getGloryMultiplier } from "@/lib/events";
import {
  evaluateAchievements,
  applyAchievementRewards,
} from "@/lib/achievements";
import type { GameState, MergeResult } from "./types";
import { isCorrectSide, bumpDailyQuest, updateTaskProgress } from "./helpers";

export interface HybridClashOutcome {
  nextState: GameState;
  dogId: number;
  catId: number;
  from: number;
  to: number;
  explosionKey: number;
  result: MergeResult;
}

export function computeHybridClash(
  s: GameState,
  from: number,
  to: number,
  comboCount: number,
): HybridClashOutcome | null {
  const a = s.board[from];
  const b = s.board[to];
  if (!a || !b) return null;
  if (
    !(
      a.tier >= MAX_TIER &&
      b.tier >= MAX_TIER &&
      a.faction !== b.faction &&
      a.faction !== "hybrid" &&
      b.faction !== "hybrid"
    )
  ) {
    return null;
  }

  const dog = a.faction === "dog" ? a : b;
  const cat = a.faction === "cat" ? a : b;

  const newBoard = s.board.slice();
  newBoard[from] = null;
  newBoard[to] = null;

  const explosionKey = Date.now();
  const color =
    EXPLOSION_SHROOM_COLORS[
      Math.floor(Math.random() * EXPLOSION_SHROOM_COLORS.length)
    ]!;

  let nextState: GameState = {
    ...s,
    board: newBoard,
    energy: Math.max(0, s.energy - ENERGY_PER_MERGE),
    totalMerges: s.totalMerges + 1,
    lastMergeAt: Date.now(),
    lastSeenAt: Date.now(),
    comboCount,
    explosion: {
      idx: to,
      color,
      key: explosionKey,
    },
    pendingHybrid: null,
  };

  const unlocked = evaluateAchievements(nextState, {
    justHybrid: true,
    combo: comboCount,
  });
  nextState = applyAchievementRewards(nextState, unlocked);

  return {
    nextState,
    dogId: dog.id,
    catId: cat.id,
    from,
    to,
    explosionKey,
    result: {
      ok: true,
      isHybrid: true,
      combo: comboCount,
      comboMult: getComboMultiplier(comboCount),
      unlocked,
    },
  };
}

/** Handles a normal same-faction, same-tier, same-variant merge (T1–T4). */
export function computeNormalMerge(
  s: GameState,
  from: number,
  to: number,
  comboMult: number,
  comboCount: number,
): { nextState: GameState; result: MergeResult } | null {
  const a = s.board[from];
  const b = s.board[to];
  if (!a || !b) return null;

  if (a.tier >= MAX_TIER || b.tier >= MAX_TIER) {
    return null;
  }

  if (a.faction !== b.faction) return null;
  if (a.tier !== b.tier) return null;

  // Only identical unit lines merge (not just same tier)
  const va = cellVariant(a);
  const vb = cellVariant(b);
  if (va !== vb) return null;

  if (!isCorrectSide(from, a.faction)) return null;
  if (!isCorrectSide(to, a.faction)) return null;

  const gloryBoostActive = s.gloryBoostUntil > Date.now();
  const events = getActiveEvents();
  const shopBoost = gloryBoostActive ? 2 : 1;

  const newTier = a.tier + 1;
  const newBoard = s.board.slice();
  newBoard[from] = null;
  newBoard[to] = {
    id: s.nextId,
    faction: a.faction,
    tier: newTier,
    variant: va,
  };

  const eventMult = getGloryMultiplier(events, newTier);
  const variantMult = VARIANT_PERFECT_MULT; // always perfect because we already enforced it
  const boost = shopBoost * eventMult * comboMult * variantMult;
  const gloryGain = Math.round(10 * Math.pow(2.2, newTier - 2) * boost);

  const token: "wardog" | "warcat" =
    s.totalMerges % 2 === 0 ? "wardog" : "warcat";
  const amount = 0.1;

  let next: GameState = {
    ...s,
    board: newBoard,
    nextId: s.nextId + 1,
    glory: s.glory + gloryGain,
    energy: Math.max(0, s.energy - ENERGY_PER_MERGE),
    totalMerges: s.totalMerges + 1,
    highestTier: Math.max(s.highestTier, newTier),
    wardogTokens: s.wardogTokens + (token === "wardog" ? amount : 0),
    warcatTokens: s.warcatTokens + (token === "warcat" ? amount : 0),
    lastMergeAt: Date.now(),
    lastSeenAt: Date.now(),
    comboCount,
  };

  next = bumpDailyQuest(next, "merge", 1);
  next = bumpDailyQuest(next, "tierUp", 1, newTier);
  next = updateTaskProgress(next);

  const unlocked = evaluateAchievements(next, { combo: comboCount });
  next = applyAchievementRewards(next, unlocked);

  return {
    nextState: next,
    result: {
      ok: true,
      token,
      amount,
      combo: comboCount,
      comboMult,
      unlocked,
      gloryGained: gloryGain,
      variantPerfect: true,
    },
  };
}
