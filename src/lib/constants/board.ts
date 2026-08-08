// src/lib/constants/board.ts
/**
 * Board & unit tier limits.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

// ── Board & Units ──────────────────────────────────────────────
export const BOARD_SIZE = 6;
export const MAX_TIER = 5;

/** Number of visual / mechanical variants per unit (0–2) */
export const VARIANT_COUNT = 3;

/** Perfect-variant merge glory multiplier */
export const VARIANT_PERFECT_MULT = 1.15;

/** Particle palettes used by MergeBurst */
export const EXPLOSION_COLORS = {
  wardog: ["#f97316", "#ea580c", "#c2410c"],
  warcat: ["#a855f7", "#9333ea", "#7e22ce"],
  hybrid: ["#fbbf24", "#f59e0b", "#d97706"],
} as const;

/** Mushroom-cloud sprite variants used by the hybrid-clash explosion */
export const EXPLOSION_SHROOM_COLORS = [
  "green",
  "purple",
  "yellow",
  "blue",
  "magenta",
] as const;

export type ExplosionColor = (typeof EXPLOSION_SHROOM_COLORS)[number];
