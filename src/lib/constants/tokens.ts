// src/lib/constants/tokens.ts
/**
 * Token rewards, anti-cheat thresholds and sync limits.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

// ── Tokens & Anti-cheat ────────────────────────────────────────
export const TOKENS_PER_MERGE = 0.12;

/** Non-merge sources buffer (tasks, quests, nukes, idle, starter, referrals, achievements) */
export const TOKEN_TOLERANCE = 3_000;

export const MIN_SYNC_INTERVAL_MS = 300;
export const ABSURD_GLORY_PER_SEC = 400;
export const ABSURD_MERGES_PER_SEC = 3;
export const ABSURD_GLORY_FLOOR = 8_000;
export const ABSURD_MERGES_FLOOR = 40;

// ── Sync & Local Lock ──────────────────────────────────────────
export const LOCAL_BOARD_LOCK_MS = 8_000;

export const MAX_MERGES_PER_10S = 12;
export const MAX_SPAWNS_PER_10S = 8;
export const MAX_SWAPS_PER_10S = 15;
