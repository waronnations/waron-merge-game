// src/lib/constants/war-mode.ts
/**
 * WAR MODE — Board as Battlefield
 * Full tactical front-line system.
 */

export const WAR_MODE_DURATION_MS = 8 * 60 * 1000; // 8 minutes
export const WAR_MODE_ENERGY_COST_TO_ENTER = 15;
export const WAR_MODE_COOLDOWN_MS = 90 * 1000; // 90s personal cooldown

/** Control points needed to fully push one sector */
export const FRONT_LINE_MAX = 100;

/** How much one merge contributes to the front line */
export const CONTROL_PER_MERGE: Record<number, number> = {
  1: 1.2,
  2: 2.0,
  3: 3.5,
  4: 5.5,
  5: 8.0,
  6: 12.0, // hybrid base
};

/** Extra control for perfect-variant merge */
export const PERFECT_VARIANT_CONTROL_BONUS = 1.8;

/** Extra control for hybrid birth / hybrid merge */
export const HYBRID_CONTROL_BONUS = 6.0;

/** Extra control when deploying a unit/hybrid */
export const DEPLOY_CONTROL_BONUS = 9.0;

/** Passive control generation while side is conquered (per 10s) */
export const CONQUERED_PASSIVE_CONTROL = 1.4;

/** How much an incoming OPS hit / nuke reduces your front line */
export const OPS_HIT_CONTROL_DRAIN = 18;
export const NUKE_CONTROL_DRAIN = 35;

/** Deployment costs & cooldowns */
export const DEPLOY_ENERGY_COST = 8;
export const DEPLOY_COOLDOWN_MS = 45 * 1000;

/** Hybrid Commander abilities */
export const HYBRID_COMMANDER_ABILITIES = {
  dualAura: {
    id: "dualAura" as const,
    name: "Dual Aura",
    desc: "+18% combo multiplier + both sides gain +1.5 control/sec while active",
    durationMs: 45_000,
  },
  trenchHold: {
    id: "trenchHold" as const,
    name: "Trench Hold",
    desc: "Incoming OPS/nuke control drain reduced by 60% for 60s",
    durationMs: 60_000,
  },
  artillery: {
    id: "artillery" as const,
    name: "Artillery Barrage",
    desc: "Instantly push front line +22 and deal 12 energy damage to target player",
    durationMs: 0,
  },
} as const;

export type HybridCommanderAbilityId = keyof typeof HYBRID_COMMANDER_ABILITIES;

/** Rewards for winning a War Mode session */
export const WAR_MODE_REWARDS = {
  victoryGlory: 2200,
  victoryWardog: 2.8,
  victoryWarcat: 2.8,
  perfectPushBonusGlory: 900,
  contributionMult: 1.0,
};

/** Visual & feel */
export const FRONT_LINE_COLORS = {
  dog: "#f97316",
  cat: "#a855f7",
  contested: "#fbbf24",
  locked: "#22c55e",
} as const;
