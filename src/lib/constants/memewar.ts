// src/lib/constants/memewar.ts
/** Memecoin War Board (War Mode on real TON jettons) — tunables. */

/** War Tax in basis points of the swapped USD value (50 = 0.5%). */
export const MEMEWAR_TAX_BPS = 50;
/** Floor for the War Tax, in USD. */
export const MEMEWAR_MIN_TAX_USD = 0.05;
/** Paying the War Tax in $WARDOG (platform token) gets this multiplier. */
export const MEMEWAR_WARDOG_TAX_MULT = 0.5;
/** TON attached to the War Tax jetton transfer (excess is refunded). */
export const MEMEWAR_TAX_GAS_TON = "0.12";
/** Default slippage per action (fraction). */
export const MEMEWAR_DEFAULT_SLIPPAGE = 0.01;
export const MEMEWAR_TOTAL_WAR_SLIPPAGE = 0.03;
export const MEMEWAR_SLIPPAGE_OPTIONS = [0.005, 0.01, 0.03, 0.05] as const;
/** Price impact above this asks the user to confirm twice. */
export const MEMEWAR_HIGH_IMPACT = 0.05;
/** Season points multiplier for Total War. */
export const MEMEWAR_TOTAL_WAR_POINTS_MULT = 2;
/** Max USD credited per recorded merge (anti-abuse cap). */
export const MEMEWAR_MAX_POINTS_USD = 10_000;
/** Season length (days). Seasons start Monday 00:00 UTC. */
export const MEMEWAR_SEASON_DAYS = 7;
/** Board size (tiles). */
export const MEMEWAR_BOARD_SLOTS = 16;
/** Ignore dust holdings below this USD value. */
export const MEMEWAR_DUST_USD = 0.01;
export const MEMEWAR_QUOTE_REFRESH_MS = 20_000;
export const MEMEWAR_CONFIRM_POLL_MS = 5_000;
export const MEMEWAR_CONFIRM_ATTEMPTS = 24;
export const MEMEWAR_INTENT_TTL_MS = 10 * 60_000;
export const MEMEWAR_DAILY_MISSION_TARGET = 3;
export const MEMEWAR_FEED_LIMIT = 20;
export const MEMEWAR_ALERT_COOLDOWN_MS = 6 * 60 * 60_000;

/** Well-known jettons used for demo boards and the global ticker. */
export const MEMEWAR_KNOWN_COINS = [
  { master: "EQAmjezmAjiXZ7XfoLGQbNIm4CIEcQwM9CNbpTZJgcN9LeVi", symbol: "WARDOG" },
  { master: "EQDMqYAfQ1FnMpvkm4aJstq2Gx2ebPLq9vcBfPSxoBNw1kqb", symbol: "WARCAT" },
  { master: "EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT", symbol: "NOT" },
  { master: "EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS", symbol: "DOGS" },
  { master: "EQAJ8uWd7EBqsmpSWaRdf_I-8R8-XHwh3gsNKhy-UrdrPcUo", symbol: "HMSTR" },
  { master: "EQD-cvR0Nz6XAyRBvbhz-abTrRC6sI5tvHvvpeQraV9UAAD7", symbol: "CATI" },
  { master: "EQBZ_cafPyDr5KUTs0aNxh0ZTDhkpEZONmLJA2SNGlLm4Cko", symbol: "REDO" },
] as const;

/** Demo amounts (whole tokens) for the board shown before a wallet connects. */
export const MEMEWAR_DEMO_AMOUNTS: Record<string, number> = {
  WARDOG: 25_000,
  WARCAT: 18_000,
  NOT: 42_000,
  DOGS: 160_000,
  HMSTR: 90_000,
  CATI: 300,
  REDO: 1_200,
};
