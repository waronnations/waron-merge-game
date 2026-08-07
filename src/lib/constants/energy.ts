// src/lib/constants/energy.ts
/**
 * Energy pool, regen and recovery — tuned for Telegram short sessions.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

// ── Energy ─────────────────────────────────────────────────────
export const MAX_ENERGY = 100;
export const ENERGY_PER_MERGE = 5;
export const SPAWN_ENERGY = 2;

/** Base: 1 energy every 75s */
export const ENERGY_REGEN_MS = 75 * 1000;

export const EARLY_GAME_MERGES = 50;
export const EARLY_GAME_REGEN_MULT = 2.2;

/** Soft mid-game boost after early game ends */
export const MID_GAME_MERGES = 180;
export const MID_GAME_REGEN_MULT = 1.35;

export const RECOVER_ENERGY_AMOUNT = 50;
/** Board energy recover — in-game $WARDOG or $WARCAT only, no wallet gate */
export const RECOVER_ENERGY_TOKEN_COST = 0.9;
