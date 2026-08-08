// src/lib/constants/energy.ts
/**
 * Energy pool, regen and recovery.
 * Merge board = energy only.
 * Paid energy (shop / recover) = topped-up spendable only.
 */

export const MAX_ENERGY = 100;
export const ENERGY_PER_MERGE = 5;
export const SPAWN_ENERGY = 2;

/** Base: 1 energy every 75s */
export const ENERGY_REGEN_MS = 75 * 1000;

export const EARLY_GAME_MERGES = 50;
export const EARLY_GAME_REGEN_MULT = 2.2;

export const MID_GAME_MERGES = 180;
export const MID_GAME_REGEN_MULT = 1.35;

export const RECOVER_ENERGY_AMOUNT = 50;
/** Topped-up spendable only (server-enforced) */
export const RECOVER_ENERGY_TOKEN_COST = 0.9;

export type EnergyTreasuryZone = "green" | "yellow" | "red" | "critical";

export const ENERGY_ZONE_REGEN_MULT: Record<EnergyTreasuryZone, number> = {
  green: 1.4,
  yellow: 1.0,
  red: 0.7,
  critical: 0.45,
};

export const ENERGY_ZONE_LABEL: Record<EnergyTreasuryZone, string> = {
  green: "Fast regen (treasury healthy)",
  yellow: "Normal regen",
  red: "Slow regen (treasury strained)",
  critical: "Very slow regen (treasury critical)",
};
