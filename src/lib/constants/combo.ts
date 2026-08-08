// src/lib/constants/combo.ts
/**
 * Merge combo streaks.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

// ── Combos ─────────────────────────────────────────────────────
/** Max gap between merges to keep a combo alive */
export const COMBO_WINDOW_MS = 2_500;
/** Hard cap on combo count */
export const MAX_COMBO = 10;
/** Glory multiplier = 1 + (combo-1) * COMBO_STEP, capped at COMBO_MAX_MULT */
export const COMBO_STEP = 0.15;
export const COMBO_MAX_MULT = 2.4;

/** Combo multiplier from streak count (1 = no bonus). */
export function getComboMultiplier(combo: number): number {
  const c = Math.max(1, Math.min(MAX_COMBO, Math.floor(combo)));
  return Math.min(COMBO_MAX_MULT, 1 + (c - 1) * COMBO_STEP);
}
