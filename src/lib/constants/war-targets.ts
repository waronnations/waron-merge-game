// src/lib/constants/war-targets.ts
/**
 * Live Targets system — countries & players that appear on the board during War Mode.
 * Connecting the merge board to real nations + OPS + nukes.
 */

export type WarTargetType = "nation" | "player";

export const TARGET_SPAWN_EVERY_MERGES = 9;           // every ~9 merges
export const TARGET_MAX_ON_BOARD = 2;                 // never more than 2 at once
export const TARGET_LIFETIME_MS = 45_000;             // 45 seconds before it expires
export const TARGET_SPAWN_ENERGY_COST = 0;            // free to appear

// Costs to attack a target (encourages top-up)
export const TARGET_ATTACK_ENERGY_COST = 12;
export const TARGET_ATTACK_TOKEN_COST = 1.5;          // wardog OR warcat

// Rewards
export const TARGET_NATION_REWARD = {
  glory: 480,
  control: 14,
  wardog: 0.8,
  warcat: 0.8,
};

export const TARGET_PLAYER_REWARD = {
  glory: 320,
  control: 9,
  wardog: 0.45,
  warcat: 0.45,
};

// Visual
export const TARGET_PULSE_COLORS = {
  nation: "#ef4444",   // red
  player: "#f59e0b",   // amber
} as const;
