// src/lib/game/war-mode.ts
/**
 * Pure War Mode logic + Live Targets integration.
 * Strict adversary-only attack rules enforced.
 * Positive EV economy: energy refund + participation rewards on every session end.
 */

import type { GameState } from "./types";
import {
  WAR_MODE_DURATION_MS,
  WAR_MODE_ENERGY_COST_TO_ENTER,
  WAR_MODE_COOLDOWN_MS,
  FRONT_LINE_MAX,
  CONTROL_PER_MERGE,
  PERFECT_VARIANT_CONTROL_BONUS,
  HYBRID_CONTROL_BONUS,
  DEPLOY_CONTROL_BONUS,
  CONQUERED_PASSIVE_CONTROL,
  DEPLOY_ENERGY_COST,
  DEPLOY_COOLDOWN_MS,
  WAR_MODE_REWARDS,
  HYBRID_COMMANDER_ABILITIES,
  type HybridCommanderAbilityId,
} from "@/lib/constants/war-mode";
import { MAX_ENERGY, ENERGY_PER_MERGE } from "@/lib/constants";
import {
  updateConquerFlags,
  isCorrectSide,
  canAttackIndex,
  createInitialWarMode,
} from "./helpers";
import {
  maybeSpawnTarget,
  cleanExpiredTargets,
  attackTarget,
  stripAllTargetCells,
} from "./war-targets";

export { createInitialWarMode };

export function canEnterWarMode(s: GameState, now = Date.now()): boolean {
  if (s.warMode?.active) return false;
  if (now < (s.warMode?.cooldownUntil ?? 0)) return false;
  if (s.energy < WAR_MODE_ENERGY_COST_TO_ENTER) return false;
  return true;
}

export function enterWarMode(s: GameState, now = Date.now()): GameState | null {
  if (!canEnterWarMode(s, now)) return null;

  return {
    ...s,
    energy: s.energy - WAR_MODE_ENERGY_COST_TO_ENTER,
    warMode: {
      ...createInitialWarMode(),
      active: true,
      startedAt: now,
      endsAt: now + WAR_MODE_DURATION_MS,
      frontLine: 50,
      controlGenerated: 0,
      lastPassiveAt: now,
      activeAbilities: [],
      targets: [],
      mergesSinceLastTarget: 0,
      hasSeenTargetTutorial: s.warMode?.hasSeenTargetTutorial ?? false,
      victory: false,
      sessionComplete: false,
      energySpent: WAR_MODE_ENERGY_COST_TO_ENTER,
      lastRewards: undefined,
    },
  };
}

export function tickWarMode(s: GameState, now = Date.now()): GameState {
  if (!s.warMode?.active) {
    return cleanExpiredTargets(s, now);
  }

  if (now >= s.warMode.endsAt) {
    return endWarMode(s, now);
  }

  let next = cleanExpiredTargets(s, now);
  const wm = next.warMode ?? createInitialWarMode();

  let frontLine = wm.frontLine;
  let controlGenerated = wm.controlGenerated;
  let lastPassiveAt = wm.lastPassiveAt ?? now;

  const elapsed = now - lastPassiveAt;
  if (elapsed >= 10_000) {
    const ticks = Math.floor(elapsed / 10_000);

    if (next.dogSideConquered) {
      frontLine = Math.max(0, frontLine - CONQUERED_PASSIVE_CONTROL * ticks);
      controlGenerated += CONQUERED_PASSIVE_CONTROL * ticks;
    }
    if (next.catSideConquered) {
      frontLine = Math.min(
        FRONT_LINE_MAX,
        frontLine + CONQUERED_PASSIVE_CONTROL * ticks,
      );
      controlGenerated += CONQUERED_PASSIVE_CONTROL * ticks;
    }

    lastPassiveAt = now - (elapsed % 10_000);
  }

  const activeAbilities = (wm.activeAbilities || []).filter(
    (a) => a.endsAt > now,
  );

  return {
    ...next,
    warMode: {
      ...wm,
      frontLine,
      controlGenerated,
      lastPassiveAt,
      activeAbilities,
    },
  };
}

/**
 * Merges push BOTH controlGenerated AND the front line.
 * dog → lower frontLine, cat → higher, hybrid → either.
 * Also tracks ENERGY_PER_MERGE toward energySpent.
 */
export function applyMergeControl(
  s: GameState,
  tier: number,
  isPerfectVariant: boolean,
  isHybrid: boolean,
  mergeFaction?: "dog" | "cat" | "hybrid",
): GameState {
  if (!s.warMode?.active) return s;

  let gain = CONTROL_PER_MERGE[tier] ?? 1.5;
  if (isPerfectVariant) gain += PERFECT_VARIANT_CONTROL_BONUS;
  if (isHybrid) gain += HYBRID_CONTROL_BONUS;

  let frontLine = s.warMode.frontLine;
  const push = gain * 0.35;

  if (mergeFaction === "dog") {
    frontLine = Math.max(0, frontLine - push);
  } else if (mergeFaction === "cat") {
    frontLine = Math.min(FRONT_LINE_MAX, frontLine + push);
  } else if (isHybrid || mergeFaction === "hybrid") {
    frontLine =
      Math.random() < 0.5
        ? Math.max(0, frontLine - push)
        : Math.min(FRONT_LINE_MAX, frontLine + push);
  }

  return {
    ...s,
    warMode: {
      ...s.warMode,
      controlGenerated: s.warMode.controlGenerated + gain,
      frontLine,
      energySpent: (s.warMode.energySpent ?? 0) + ENERGY_PER_MERGE,
    },
  };
}

export function afterMergeWarMode(
  s: GameState,
  realPlayers: string[] = [],
  now = Date.now(),
): GameState {
  if (!s.warMode?.active) return s;
  let next = tickWarMode(s, now);
  next = maybeSpawnTarget(next, now, realPlayers);
  return next;
}

/**
 * Deploy a unit or attack a Live Target.
 * Strict adversary-only rules are enforced.
 */
export function deployUnit(
  s: GameState,
  index: number,
  now = Date.now(),
): { nextState: GameState; ok: boolean; reason?: string } {
  if (!s.warMode?.active) {
    return { nextState: s, ok: false, reason: "War Mode not active" };
  }
  if (s.energy < DEPLOY_ENERGY_COST) {
    return { nextState: s, ok: false, reason: "Not enough energy" };
  }

  const cell = s.board[index];
  if (!cell) return { nextState: s, ok: false, reason: "Empty cell" };

  // ── Live Target attack ─────────────────────────────────────
  if (cell.isTarget) {
    const attackerFaction: "dog" | "cat" | "hybrid" = s.board.some(
      (c) => c?.faction === "hybrid",
    )
      ? "hybrid"
      : isCorrectSide(index, "dog")
        ? "cat"
        : "dog";

    if (!canAttackIndex(attackerFaction, index)) {
      return {
        nextState: s,
        ok: false,
        reason:
          attackerFaction === "dog"
            ? "WARDOG can only strike the WARCAT side"
            : "WARCAT can only strike the WARDOG side",
      };
    }

    const result = attackTarget(s, index, attackerFaction, now);
    return {
      nextState: result.nextState,
      ok: result.ok,
      reason: result.reason,
    };
  }

  // ── Normal unit deploy ─────────────────────────────────────
  if (cell.tier < 4 && cell.faction !== "hybrid") {
    return {
      nextState: s,
      ok: false,
      reason: "Only tier 4+ or hybrids can deploy",
    };
  }
  if (cell.deployedUntil && cell.deployedUntil > now) {
    return { nextState: s, ok: false, reason: "Already deployed" };
  }

  if (cell.faction !== "hybrid" && !isCorrectSide(index, cell.faction)) {
    return { nextState: s, ok: false, reason: "Unit on wrong side" };
  }

  const board = [...s.board];
  board[index] = {
    ...cell,
    deployedUntil: now + DEPLOY_COOLDOWN_MS,
  };

  const gain = DEPLOY_CONTROL_BONUS + (cell.faction === "hybrid" ? 8 : 0);

  let frontLine = s.warMode.frontLine;
  if (cell.faction === "dog") {
    frontLine = Math.max(0, frontLine - gain);
  } else if (cell.faction === "cat") {
    frontLine = Math.min(FRONT_LINE_MAX, frontLine + gain);
  } else {
    frontLine =
      Math.random() < 0.5
        ? Math.max(0, frontLine - gain)
        : Math.min(FRONT_LINE_MAX, frontLine + gain);
  }

  const next: GameState = {
    ...s,
    board,
    energy: s.energy - DEPLOY_ENERGY_COST,
    warMode: {
      ...s.warMode,
      frontLine,
      controlGenerated: s.warMode.controlGenerated + gain,
      energySpent: (s.warMode.energySpent ?? 0) + DEPLOY_ENERGY_COST,
    },
  };

  return { nextState: updateConquerFlags(next), ok: true };
}

export function activateHybridAbility(
  s: GameState,
  abilityId: HybridCommanderAbilityId,
  now = Date.now(),
): GameState | null {
  if (!s.warMode?.active) return null;

  const def = HYBRID_COMMANDER_ABILITIES[abilityId];
  if (!def) return null;

  const hasHybrid = s.board.some((c) => c && c.faction === "hybrid");
  if (!hasHybrid) return null;

  const activeAbilities = [
    ...(s.warMode.activeAbilities || []).filter((a) => a.endsAt > now),
    { id: abilityId, endsAt: now + def.durationMs },
  ];

  let frontLine = s.warMode.frontLine;
  let controlGenerated = s.warMode.controlGenerated;

  if (abilityId === "artillery") {
    frontLine = Math.min(FRONT_LINE_MAX, frontLine + 22);
    controlGenerated += 22;
  }

  return {
    ...s,
    warMode: {
      ...s.warMode,
      activeAbilities,
      frontLine,
      controlGenerated,
    },
  };
}

export function endWarMode(s: GameState, now = Date.now()): GameState {
  if (!s.warMode?.active) return s;

  const front = s.warMode.frontLine;
  const control = s.warMode.controlGenerated ?? 0;
  const energySpent =
    s.warMode.energySpent ?? WAR_MODE_ENERGY_COST_TO_ENTER;

  const isVictory = front <= 5 || front >= 95;
  const isPerfect = (front <= 2 || front >= 98) && control > 80;

  // ── Always-positive economy ────────────────────────────────
  let glory = WAR_MODE_REWARDS.participationGlory;
  let wardog = WAR_MODE_REWARDS.participationWardog;
  let warcat = WAR_MODE_REWARDS.participationWarcat;

  glory += Math.floor(control * WAR_MODE_REWARDS.controlGloryMult);

  if (isVictory) {
    glory += WAR_MODE_REWARDS.victoryGlory;
    wardog += WAR_MODE_REWARDS.victoryWardog;
    warcat += WAR_MODE_REWARDS.victoryWarcat;
  }
  if (isPerfect) {
    glory += WAR_MODE_REWARDS.perfectPushBonusGlory;
  }

  const energyRefund = Math.max(
    WAR_MODE_REWARDS.energyRefundMin,
    Math.ceil(energySpent * WAR_MODE_REWARDS.energyRefundMult),
  );

  const board = stripAllTargetCells(s.board);

  const lastRewards = {
    glory,
    wardog,
    warcat,
    energyRefund,
  };

  return {
    ...s,
    board,
    glory: s.glory + glory,
    wardogTokens: s.wardogTokens + wardog,
    warcatTokens: s.warcatTokens + warcat,
    energy: Math.min(MAX_ENERGY, (s.energy ?? 0) + energyRefund),
    warMode: {
      ...createInitialWarMode(),
      cooldownUntil: now + WAR_MODE_COOLDOWN_MS,
      victory: isVictory,
      sessionComplete: true,
      hasSeenTargetTutorial: s.warMode.hasSeenTargetTutorial,
      frontLine: front,
      controlGenerated: control,
      lastRewards,
      energySpent,
    },
  };
}

export function clearWarModeVictory(s: GameState): GameState {
  if (!s.warMode) return s;
  return {
    ...s,
    warMode: {
      ...s.warMode,
      victory: false,
      sessionComplete: false,
      lastRewards: undefined,
    },
  };
}

export function applyControlDrain(
  s: GameState,
  amount: number,
  now = Date.now(),
): GameState {
  if (!s.warMode?.active) return s;

  const hasTrench = (s.warMode.activeAbilities || []).some(
    (a) => a.id === "trenchHold" && a.endsAt > now,
  );
  const finalAmount = hasTrench ? amount * 0.4 : amount;

  let frontLine = s.warMode.frontLine;
  if (frontLine < 50) frontLine = Math.min(50, frontLine + finalAmount);
  else frontLine = Math.max(50, frontLine - finalAmount);

  return {
    ...s,
    warMode: {
      ...s.warMode,
      frontLine,
    },
  };
}

export function markTargetTutorialSeen(s: GameState): GameState {
  if (!s.warMode) return s;
  return {
    ...s,
    warMode: {
      ...s.warMode,
      hasSeenTargetTutorial: true,
    },
  };
}
