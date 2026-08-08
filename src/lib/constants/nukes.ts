// src/lib/constants/nukes.ts
/**
 * Strategic nukes: launches, rewards and strike effects.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

// ── Nukes (unlimited launches — only limited by nukesOwned) ─────
export const MAX_NUKE_LAUNCHES_PER_DAY = 999_999;
export const TERRORIST_THRESHOLD = 50;
export const NUKE_TRANSFER_VALUE = 1.8;
export const PEACEFUL_DAYS = 7;

export const NUKE_REWARDS = {
  normal: { glory: 600, energy: 25, tokens: 0.6 },
  peaceful: { glory: 250, energy: 12, tokens: 0.25 },
  terroristPenaltyMult: 0.75,
} as const;

/** @deprecated kept for migration / anti-cheat validation only */
export const MAX_NUKES_PER_DAY = 999_999;

// ── Nuke Strike Effects ────────────────────────────────────────
export const NUKE_HIT_DISABLE_MS = 60 * 1000; // 60 seconds
export const NUKE_PROTECTION_MS = 6 * 60 * 1000; // 6 minutes
export const NUKE_REVENGE_READY_MS = 5 * 60 * 1000; // 5 minutes
