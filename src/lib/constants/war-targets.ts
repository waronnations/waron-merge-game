// src/lib/constants/war-targets.ts

/** How many merges between target spawns */
export const TARGET_SPAWN_EVERY_MERGES = 4;

/** Max targets on the board at the same time */
export const TARGET_MAX_ON_BOARD = 2;

/** How long a target stays on the board (ms) */
export const TARGET_LIFETIME_MS = 45_000;

/**
 * Costs to attack a Live Target
 * Set to 0 while testing so attacks always succeed.
 * Later you can raise them (e.g. energy 5, tokens 1).
 */
export const TARGET_ATTACK_ENERGY_COST = 0;
export const TARGET_ATTACK_TOKEN_COST = 0;

/** Rewards when you successfully attack */
export const TARGET_NATION_REWARD = {
  glory: 480,
  wardog: 0.5,
  warcat: 0.5,
  control: 12,
};

export const TARGET_PLAYER_REWARD = {
  glory: 320,
  wardog: 0.3,
  warcat: 0.3,
  control: 8,
};
