// src/lib/constants/idle.ts
/**
 * Idle rewards and starter pack.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

// ── Idle Rewards ───────────────────────────────────────────────
export const IDLE_CAP_HOURS = 10;
export const IDLE_GLORY_PER_MIN = 0.65;
export const IDLE_TOKEN_PER_HOUR = 0.06;
export const IDLE_MIN_MINUTES = 2;

// ── Starter Pack ───────────────────────────────────────────────
export const STARTER_PACK = {
  glory: 250,
  energy: 100,
  wardog: 0.8,
  warcat: 0.8,
} as const;
