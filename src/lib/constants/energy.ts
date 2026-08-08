// src/lib/constants/energy.ts
/**
 * Energy pool, regen and recovery — tuned for Telegram short sessions.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 *
 * DYNAMIC RULE:
 *   Merge board is free (energy only).
 *   Passive regen speed is adjusted by Claim Treasury health zone.
 */

// ── Energy ─────────────────────────────────────────────────────
export const MAX_ENERGY = 100;
export const ENERGY_PER_MERGE = 5;
export const SPAWN_ENERGY = 2;

/** Base: 1 energy every 75s (before all multipliers) */
export const ENERGY_REGEN_MS = 75 * 1000;

export const EARLY_GAME_MERGES = 50;
export const EARLY_GAME_REGEN_MULT = 2.2;

/** Soft mid-game boost after early game ends */
export const MID_GAME_MERGES = 180;
export const MID_GAME_REGEN_MULT = 1.35;

export const RECOVER_ENERGY_AMOUNT = 50;
/** Board energy recover — requires topped-up spendable (server-enforced) */
export const RECOVER_ENERGY_TOKEN_COST = 0.9;

/**
 * Passive energy regen multiplier by Claim Treasury zone.
 * Applied on top of early/mid-game and event multipliers.
 */
export type EnergyTreasuryZone = "green" | "yellow" | "red" | "critical";

export const ENERGY_ZONE_REGEN_MULT: Record<EnergyTreasuryZone, number> = {
  green: 1.4, // healthy pool → faster play
  yellow: 1.0, // normal
  red: 0.7, // strained
  critical: 0.45, // pool under pressure
};

/** Human-readable label for UI */
export const ENERGY_ZONE_LABEL: Record<EnergyTreasuryZone, string> = {
  green: "Fast regen (treasury healthy)",
  yellow: "Normal regen",
  red: "Slow regen (treasury strained)",
  critical: "Very slow regen (treasury critical)",
};
