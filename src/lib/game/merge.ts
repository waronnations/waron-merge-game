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
import {
  isCorrectSide,
  canAttackIndex,
  bumpDailyQuest,
  updateTaskProgress,
  updateConquerFlags,
} from "./helpers";
import { tickWarMode, applyMergeControl, afterMergeWarMode } from "./war-mode";
import { attackTarget } from "./war-targets";
import { TARGET_ATTACK_ENERGY_COST } from "@/lib/constants/war-targets";

export interface HybridClashOutcome {
  nextState: GameState;
  dogId: number;
  catId: number;
  from: number;
  to: number;
  explosionKey: number;
  result: MergeResult;
}

/**
 * Attack a Live Target by merging into it (War Mode only).
 *
 * Rules:
 * - Must be on the adversary half only
 * - Nation (country) → T5 or Hybrid only
 * - Telegram player → under T5 only (tier 1–4)
 */
export function computeTargetAttack(
  s: GameState,
  from: number,
  to: number,
): { nextState: GameState; result: MergeResult; rewardText?: string } | null {
  const attacker = s.board[from];
  const target = s.board[to];

  if (!attacker || !target || !target.isTarget) return null;
  if (attacker.faction === "target") return null;
  if (!s.warMode?.active) return null;

  if (!canAttackIndex(attacker.faction, to)) return null;

  const isNation = target.targetType === "nation";
  const isPlayer = target.targetType === "player";

  if (isNation) {
    if (attacker.tier < MAX_TIER && attacker.faction !== "hybrid") return null;
  } else if (isPlayer) {
    if (attacker.faction !== "hybrid" && attacker.tier >= MAX_TIER) return null;
  } else {
    return null;
  }

  const attackResult = attackTarget(
    s,
    to,
    attacker.faction === "hybrid"
      ? "hybrid"
      : attacker.faction === "dog"
        ? "dog"
        : "cat",
  );
  if (!attackResult.ok) return null;

  const board = [...attackResult.nextState.board];
  board[from] = null;

  const energyCost =
    TARGET_ATTACK_ENERGY_COST > 0 ? TARGET_ATTACK_ENERGY_COST : ENERGY_PER_MERGE;

  let nextState: GameState = {
    ...attackResult.nextState,
    board,
    energy: Math.max(0, attackResult.nextState.energy - energyCost),
    totalMerges: attackResult.nextState.totalMerges + 1,
    lastMergeAt: Date.now(),
    lastSeenAt: Date.now(),
  };

  // Track energy spent on target strikes during war
  if (nextState.warMode?.active) {
    nextState = {
      ...nextState,
      warMode: {
        ...nextState.warMode,
        energySpent: (nextState.warMode.energySpent ?? 0) + energyCost,
      },
    };
  }

  nextState = bumpDailyQuest(nextState, "merge", 1);
  nextState = updateTaskProgress(nextState);
  nextState = updateConquerFlags(nextState);
  nextState = afterMergeWarMode(nextState);

  return {
    nextState,
    result: {
      ok: true,
      gloryGained: isNation ? 480 : 320,
      combo: 1,
    },
    rewardText: attackResult.rewardText,
  };
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
  nextState = updateConquerFlags(nextState);
  nextState = tickWarMode(nextState);
  nextState = applyMergeControl(nextState, 6, false, true, "hybrid");

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

  if (a.faction === "target" || b.faction === "target") return null;

  if (a.tier >= MAX_TIER || b.tier >= MAX_TIER) return null;
  if (a.faction !== b.faction) return null;
  if (a.tier !== b.tier) return null;

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
  const variantMult = VARIANT_PERFECT_MULT;
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
  next = updateConquerFlags(next);
  next = tickWarMode(next);
  next = applyMergeControl(
    next,
    newTier,
    true,
    false,
    a.faction as "dog" | "cat",
  );
  next = afterMergeWarMode(next);

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

/**
 * Hybrid ↔ Hybrid merge (any hybrids of the same tier)
 */
export function computeHybridMerge(
  s: GameState,
  from: number,
  to: number,
  comboMult: number,
  comboCount: number,
): { nextState: GameState; result: MergeResult } | null {
  const a = s.board[from];
  const b = s.board[to];
  if (!a || !b) return null;

  if (a.faction === "target" || b.faction === "target") return null;
  if (a.faction !== "hybrid" || b.faction !== "hybrid") return null;
  if (a.tier !== b.tier) return null;

  const aIsAI = !!(a.imageUrl || a.seed);
  const bIsAI = !!(b.imageUrl || b.seed);
  const keepAI = aIsAI && bIsAI;

  const newTier = a.tier + 1;
  const newBoard = s.board.slice();
  newBoard[from] = null;

  newBoard[to] = {
    id: s.nextId,
    faction: "hybrid",
    tier: newTier,
    isHybrid: true,
    parentDogId: a.parentDogId || b.parentDogId,
    parentCatId: a.parentCatId || b.parentCatId,
    imageUrl: keepAI ? a.imageUrl || b.imageUrl : undefined,
    seed: keepAI ? a.seed || b.seed : undefined,
  };

  const gloryGain = Math.round(
    25 * Math.pow(1.8, Math.max(0, newTier - 6)) * comboMult,
  );

  let next: GameState = {
    ...s,
    board: newBoard,
    nextId: s.nextId + 1,
    glory: s.glory + gloryGain,
    energy: Math.max(0, s.energy - ENERGY_PER_MERGE),
    totalMerges: s.totalMerges + 1,
    highestTier: Math.max(s.highestTier, newTier),
    lastMergeAt: Date.now(),
    lastSeenAt: Date.now(),
    comboCount,
  };

  next = bumpDailyQuest(next, "merge", 1);
  next = bumpDailyQuest(next, "hybridMerge", 1);
  next = updateTaskProgress(next);

  const unlocked = evaluateAchievements(next, {
    combo: comboCount,
    justHybrid: true,
  });
  next = applyAchievementRewards(next, unlocked);
  next = updateConquerFlags(next);
  next = tickWarMode(next);
  next = applyMergeControl(next, newTier, false, true, "hybrid");
  next = afterMergeWarMode(next);

  return {
    nextState: next,
    result: {
      ok: true,
      isHybrid: true,
      combo: comboCount,
      comboMult,
      unlocked,
      gloryGained: gloryGain,
    },
  };
}
