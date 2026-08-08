/**
 * Server-only core state helpers: schema, normalization, progress
 * load/write and transition validation.
 */

import { z } from "zod";
import { sql } from "@/lib/db.server";
import { readSession } from "@/lib/session.server";
import { addWeeklyGlory } from "@/lib/nations.server";
import { addSeasonalGlory } from "@/lib/seasons.server";
import {
  BOARD_SIZE,
  MAX_ENERGY,
  MIN_SYNC_INTERVAL_MS,
  ABSURD_GLORY_PER_SEC,
  ABSURD_MERGES_PER_SEC,
  ABSURD_GLORY_FLOOR,
  ABSURD_MERGES_FLOOR,
  MAX_NUKES_PER_DAY,
  MAX_NUKE_LAUNCHES_PER_DAY,
  TERRORIST_THRESHOLD,
  TOKENS_PER_MERGE,
  TOKEN_TOLERANCE,
  SHOP_ITEMS,
  STARTER_PACK,
} from "@/lib/constants";
import { normalizeToken } from "@/lib/tokens";

export {
  MAX_ENERGY,
  TOKENS_PER_MERGE,
  TOKEN_TOLERANCE,
  MIN_SYNC_INTERVAL_MS,
  ABSURD_GLORY_PER_SEC,
  ABSURD_MERGES_PER_SEC,
  ABSURD_GLORY_FLOOR,
  ABSURD_MERGES_FLOOR,
  MAX_NUKES_PER_DAY,
  MAX_NUKE_LAUNCHES_PER_DAY,
  TERRORIST_THRESHOLD,
};

export const MAX_HIGHEST_TIER = 6;

export const StateSchema = z.object({
  board: z.array(z.any()).max(BOARD_SIZE * BOARD_SIZE),
  nextId: z.number().int().nonnegative(),
  glory: z.number().int().nonnegative(),
  energy: z.number().min(0).max(MAX_ENERGY),
  lastRegenAt: z.number().nonnegative(),
  totalMerges: z.number().int().nonnegative(),
  highestTier: z.number().int().min(1).max(MAX_HIGHEST_TIER),
  lastDailyClaim: z.number().nonnegative(),
  dailyStreak: z.number().int().nonnegative(),
  tasks: z.array(z.any()).max(20),
  dailyQuests: z.array(z.any()).max(10),
  dailyQuestsDate: z.number().nonnegative(),
  wardogTokens: z.number().nonnegative(),
  warcatTokens: z.number().nonnegative(),
  referralCode: z.string().max(32),
  referrals: z.array(z.any()).max(1000),
  invitedBy: z.string().max(64).optional(),
  hasSeenTutorial: z.boolean().optional(),
  gloryBoostUntil: z.number().nonnegative().optional(),
  lastSeenAt: z.number().nonnegative().optional(),
  pendingIdleReward: z.any().optional(),

  // ── New nuke system ──────────────────────────────────────────
  nukesOwned: z.number().int().nonnegative().optional(),
  nukesLaunchedToday: z.number().int().nonnegative().optional(),
  lastNukeDay: z.number().nonnegative().optional(),
  totalNukesLaunched: z.number().int().nonnegative().optional(),
  isTerrorist: z.boolean().optional(),
  lastNukeTargetId: z.number().int().nullable().optional(),

  // deprecated – kept for migration of old local saves
  nukesUsedToday: z.number().int().nonnegative().optional(),

  pendingHybrid: z.any().optional(),
  hybrids: z.array(z.any()).max(50).optional(),
  explosion: z.any().optional(),

  // ── Gift boxes inventory (additive) ──────────────────────────
  giftBoxes: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

export type ServerGameState = z.infer<typeof StateSchema>;

export interface ProgressRow {
  glory: number;
  total_merges: number;
  highest_tier: number;
  wardog_tokens: number;
  warcat_tokens: number;
  state: ServerGameState;
  /** true when the stored JSONB state was missing/empty and had to be defaulted */
  stateEmpty: boolean;
  last_sync_at: string;
}

export type Cell = {
  id: number;
  faction: "dog" | "cat" | "hybrid";
  tier: number;
  parentDogId?: number;
  parentCatId?: number;
  isHybrid?: boolean;
  seed?: string;
  imageUrl?: string;
};

export type SyncResult = { ok: true } | { ok: false; reason: string };

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string | null;
  firstName: string | null;
  glory: number;
  highestTier: number;
  totalMerges: number;
}

export const LeaderboardInput = z.object({
  limit: z.number().int().min(1).max(200).default(50),
});

export type LeaderboardInput = z.infer<typeof LeaderboardInput>;

export const SHOP_ITEMS_SERVER = {
  energyPack: {
    cost: SHOP_ITEMS.energyPack.cost,
    energy: (SHOP_ITEMS.energyPack as any).energy,
  },
  gloryBoost: {
    cost: SHOP_ITEMS.gloryBoost.cost,
    durationMs: (SHOP_ITEMS.gloryBoost as any).durationMs,
  },
  nukePack: { cost: SHOP_ITEMS.nukePack.cost },

  // Gift Boxes
  gift_common: { cost: (SHOP_ITEMS as any).gift_common?.cost ?? 0.5 },
  gift_wardog: { cost: (SHOP_ITEMS as any).gift_wardog?.cost ?? 1.2 },
  gift_warcat: { cost: (SHOP_ITEMS as any).gift_warcat?.cost ?? 1.2 },
  gift_nuke: { cost: (SHOP_ITEMS as any).gift_nuke?.cost ?? 2.0 },
  gift_legendary: { cost: (SHOP_ITEMS as any).gift_legendary?.cost ?? 4.5 },
} as const;

export type ShopItemIdServer = keyof typeof SHOP_ITEMS_SERVER;

export async function requireUserId(): Promise<number> {
  const session = await readSession();
  const userId = session.data?.userId;
  if (!userId) throw new Error("unauthorized");
  return userId;
}

export function finite(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function clampServerEnergy(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > MAX_ENERGY) return MAX_ENERGY;
  return n;
}

export function countUnits(board: unknown): number {
  if (!Array.isArray(board)) return 0;
  let n = 0;
  for (const c of board) if (c != null) n++;
  return n;
}

export function truncateToDay(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export function isCorrectSide(index: number, faction: string): boolean {
  if (faction === "hybrid") return true;
  const col = index % BOARD_SIZE;
  return faction === "dog" ? col < 3 : col >= 3;
}

export function gloryForTier(tier: number): number {
  const base = [0, 10, 25, 60, 150, 400, 1200];
  return base[Math.min(tier, 6)] || 10;
}

export function ensureBoard(state: ServerGameState): (Cell | null)[] {
  return sanitizeServerBoard(state.board);
}

export function alignStateWithColumns(
  state: ServerGameState,
  prev: ProgressRow,
): ServerGameState {
  return {
    ...state,
    glory: prev.glory,
    totalMerges: prev.total_merges,
    highestTier: prev.highest_tier,
    wardogTokens: prev.wardog_tokens,
    warcatTokens: prev.warcat_tokens,
  };
}

/** Server-side board sanitizer: fixed length, unique positive ids, valid faction/tier. */
export function sanitizeServerBoard(board: unknown): (Cell | null)[] {
  const size = BOARD_SIZE * BOARD_SIZE;
  const out: (Cell | null)[] = Array(size).fill(null);
  if (!Array.isArray(board)) return out;

  const seen = new Set<number>();
  for (let i = 0; i < size; i++) {
    const raw = board[i];
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Partial<Cell>;

    const id = Number(c.id);
    if (!Number.isFinite(id) || id <= 0 || seen.has(Math.floor(id))) continue;

    const faction = c.faction;
    if (faction !== "dog" && faction !== "cat" && faction !== "hybrid") continue;

    const tierRaw = Number(c.tier);
    const tier = Number.isFinite(tierRaw)
      ? Math.max(1, Math.min(6, Math.floor(tierRaw)))
      : 1;

    seen.add(Math.floor(id));
    const cell: Cell = { id: Math.floor(id), faction, tier };
    if (typeof c.seed === "string" && c.seed) cell.seed = c.seed;
    if (typeof c.imageUrl === "string" && c.imageUrl) cell.imageUrl = c.imageUrl;
    if (typeof c.parentDogId === "number") cell.parentDogId = c.parentDogId;
    if (typeof c.parentCatId === "number") cell.parentCatId = c.parentCatId;
    if (c.isHybrid) cell.isHybrid = true;
    out[i] = cell;
  }
  return out;
}

/**
 * Repairs any stored state into a fully valid ServerGameState.
 * Guarantees finite energy/glory/tokens, a 36-cell board and a safe nextId,
 * so no commit can ever write NaN/null into the numeric fields.
 */
export function normalizeServerState(
  raw: unknown,
  row?: {
    glory?: number;
    total_merges?: number;
    highest_tier?: number;
    wardog_tokens?: number;
    warcat_tokens?: number;
  },
): ServerGameState {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const isEmpty = Object.keys(s).length === 0;

  const board = sanitizeServerBoard(s.board);
  let maxId = 0;
  let maxTier = 1;
  for (const c of board) {
    if (!c) continue;
    if (c.id > maxId) maxId = c.id;
    if (c.tier > maxTier) maxTier = c.tier;
  }

  const glory = Math.max(
    0,
    Math.floor(finite(s.glory, finite(row?.glory, 0))),
  );
  const totalMerges = Math.max(
    0,
    Math.floor(finite(s.totalMerges, finite(row?.total_merges, 0))),
  );
  const highestTier = Math.max(
    maxTier,
    Math.min(
      MAX_HIGHEST_TIER,
      Math.max(1, Math.floor(finite(s.highestTier, finite(row?.highest_tier, 1)))),
    ),
  );

  const nukesOwned = Math.max(0, Math.floor(finite(s.nukesOwned, 0)));
  const nukesLaunchedToday = Math.max(
    0,
    Math.floor(finite(s.nukesLaunchedToday, finite(s.nukesUsedToday, 0))),
  );
  const totalNukesLaunched = Math.max(
    0,
    Math.floor(finite(s.totalNukesLaunched, 0)),
  );
  const isTerrorist =
    Boolean(s.isTerrorist) || totalNukesLaunched >= TERRORIST_THRESHOLD;

  // Preserve giftBoxes inventory
  const giftBoxes =
    s.giftBoxes && typeof s.giftBoxes === "object"
      ? (s.giftBoxes as Record<string, number>)
      : {};

  return {
    ...s,
    board,
    nextId: Math.max(100, maxId + 1, Math.floor(finite(s.nextId, 0))),
    glory,
    energy: clampServerEnergy(
      s.energy,
      isEmpty ? STARTER_PACK.energy : MAX_ENERGY,
    ),
    lastRegenAt: Math.max(0, Math.floor(finite(s.lastRegenAt, Date.now()))),
    totalMerges,
    highestTier,
    lastDailyClaim: Math.max(0, Math.floor(finite(s.lastDailyClaim, 0))),
    dailyStreak: Math.max(0, Math.floor(finite(s.dailyStreak, 0))),
    tasks: Array.isArray(s.tasks) ? s.tasks : [],
    dailyQuests: Array.isArray(s.dailyQuests) ? s.dailyQuests : [],
    dailyQuestsDate: Math.max(0, Math.floor(finite(s.dailyQuestsDate, 0))),
    wardogTokens: normalizeToken(
      finite(s.wardogTokens, finite(row?.wardog_tokens, 0)),
    ),
    warcatTokens: normalizeToken(
      finite(s.warcatTokens, finite(row?.warcat_tokens, 0)),
    ),
    referralCode: typeof s.referralCode === "string" ? s.referralCode : "",
    referrals: Array.isArray(s.referrals) ? s.referrals : [],
    hybrids: Array.isArray(s.hybrids) ? s.hybrids : [],

    // New nuke fields
    nukesOwned,
    nukesLaunchedToday,
    lastNukeDay: Math.max(0, Math.floor(finite(s.lastNukeDay, 0))),
    totalNukesLaunched,
    isTerrorist,
    lastNukeTargetId:
      typeof s.lastNukeTargetId === "number" ? s.lastNukeTargetId : null,

    // keep deprecated field in sync
    nukesUsedToday: nukesLaunchedToday,

    gloryBoostUntil: Math.max(0, Math.floor(finite(s.gloryBoostUntil, 0))),

    // Gift boxes
    giftBoxes,
  } as ServerGameState;
}

export async function loadProgress(
  userId: number,
): Promise<ProgressRow | null> {
  const res = await sql`
    SELECT glory, total_merges, highest_tier, wardog_tokens, warcat_tokens,
           state, last_sync_at
    FROM progress WHERE user_id = ${userId} LIMIT 1
  `;
  const row = res.rows[0];
  if (!row) return null;

  const rawState = row.state as unknown;
  const stateEmpty =
    !rawState ||
    typeof rawState !== "object" ||
    Object.keys(rawState as object).length === 0;

  const columns = {
    glory: Number(row.glory),
    total_merges: Number(row.total_merges),
    highest_tier: Number(row.highest_tier),
    wardog_tokens: Number(row.wardog_tokens),
    warcat_tokens: Number(row.warcat_tokens),
  };

  return {
    ...columns,
    state: normalizeServerState(rawState, columns),
    stateEmpty,
    last_sync_at: row.last_sync_at as string,
  };
}

export function validateBoard(state: ServerGameState): SyncResult {
  const size = BOARD_SIZE * BOARD_SIZE;
  const board = state.board;

  if (!Array.isArray(board) || board.length !== size) {
    return { ok: false, reason: "invalid_board_size" };
  }

  const seenIds = new Set<number>();
  let maxTierFound = 0;
  let t5Count = 0;

  for (let i = 0; i < size; i++) {
    const cell = board[i];
    if (cell == null) continue;
    if (typeof cell !== "object") return { ok: false, reason: "invalid_cell" };

    const id = Number((cell as any).id);
    const faction = (cell as any).faction;
    const tier = Number((cell as any).tier);

    if (!Number.isFinite(id) || id <= 0 || seenIds.has(id)) {
      return { ok: false, reason: "invalid_or_duplicate_id" };
    }
    seenIds.add(id);

    if (faction !== "dog" && faction !== "cat" && faction !== "hybrid") {
      return { ok: false, reason: "invalid_faction" };
    }
    if (!Number.isFinite(tier) || tier < 1 || tier > 6) {
      return { ok: false, reason: "invalid_tier" };
    }

    if (tier > maxTierFound) maxTierFound = tier;
    if (tier >= 5) t5Count++;
  }

  if (state.nextId <= Math.max(0, ...Array.from(seenIds))) {
    return { ok: false, reason: "invalid_nextId" };
  }
  if (state.highestTier < maxTierFound) {
    return { ok: false, reason: "highest_tier_mismatch" };
  }
  if (state.totalMerges < t5Count * 12) {
    return { ok: false, reason: "impossible_t5_count" };
  }
  if (state.totalMerges < 20 && t5Count > 0) {
    return { ok: false, reason: "early_t5_impossible" };
  }

  return { ok: true };
}

export function validateTransition(
  prev: ProgressRow,
  next: ServerGameState,
  now: number,
): SyncResult {
  const lastSyncMs = new Date(prev.last_sync_at).getTime();
  const elapsedMs = Math.max(0, now - lastSyncMs);

  if (elapsedMs < MIN_SYNC_INTERVAL_MS) {
    return { ok: false, reason: "rate_limited" };
  }

  const elapsedSec = Math.max(elapsedMs / 1000, 1);

  if (next.glory < prev.glory) return { ok: false, reason: "glory_regressed" };
  if (next.totalMerges < prev.total_merges)
    return { ok: false, reason: "merges_regressed" };
  if (next.highestTier < prev.highest_tier)
    return { ok: false, reason: "tier_regressed" };

  const gloryDelta = next.glory - prev.glory;
  const mergesDelta = next.totalMerges - prev.total_merges;

  if (gloryDelta > ABSURD_GLORY_PER_SEC * elapsedSec + ABSURD_GLORY_FLOOR) {
    return { ok: false, reason: "glory_burst" };
  }
  if (mergesDelta > ABSURD_MERGES_PER_SEC * elapsedSec + ABSURD_MERGES_FLOOR) {
    return { ok: false, reason: "merges_burst" };
  }

  const prevUnits = countUnits(prev.state?.board);
  const nextUnits = countUnits(next.board);
  if (nextUnits > prevUnits + mergesDelta + 8) {
    return { ok: false, reason: "impossible_unit_growth" };
  }

  const claimedTotal =
    Number(next.wardogTokens) + Number(next.warcatTokens);
  const maxEarnable = next.totalMerges * TOKENS_PER_MERGE + TOKEN_TOLERANCE;
  if (claimedTotal > maxEarnable + 0.001) {
    return { ok: false, reason: "token_inflation" };
  }

  if (next.energy > MAX_ENERGY) return { ok: false, reason: "energy_overflow" };

  // Soft only — unlimited launches; block absurd client-side inflation
  const nukesUsed = Number(
    next.nukesLaunchedToday ?? next.nukesUsedToday ?? 0,
  );
  if (nukesUsed > 50_000) {
    return { ok: false, reason: "nuke_overflow" };
  }

  if (next.lastDailyClaim > 0 && next.lastDailyClaim > now + 86_400_000) {
    return { ok: false, reason: "daily_claim_future" };
  }

  const boardCheck = validateBoard(next);
  if (!boardCheck.ok) return boardCheck;

  return { ok: true };
}

export async function writeProgress(
  userId: number,
  data: ServerGameState,
  opts?: { touchSyncClock?: boolean; gloryDelta?: number },
) {
  const touch = opts?.touchSyncClock !== false;
  const gloryDelta = opts?.gloryDelta ?? 0;

  const normalized = normalizeServerState(data);
  const safeWardog = normalizeToken(normalized.wardogTokens);
  const safeWarcat = normalizeToken(normalized.warcatTokens);

  const cleanState: ServerGameState = {
    ...normalized,
    wardogTokens: safeWardog,
    warcatTokens: safeWarcat,
  };

  if (touch) {
    await sql`
      INSERT INTO progress (
        user_id, glory, total_merges, highest_tier,
        wardog_tokens, warcat_tokens, state, last_sync_at, updated_at
      )
      VALUES (
        ${userId},
        ${cleanState.glory},
        ${cleanState.totalMerges},
        ${cleanState.highestTier},
        ${safeWardog},
        ${safeWarcat},
        ${JSON.stringify(cleanState)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        glory         = EXCLUDED.glory,
        total_merges  = EXCLUDED.total_merges,
        highest_tier  = EXCLUDED.highest_tier,
        wardog_tokens = EXCLUDED.wardog_tokens,
        warcat_tokens = EXCLUDED.warcat_tokens,
        state         = EXCLUDED.state,
        last_sync_at  = NOW(),
        updated_at    = NOW();
    `;
  } else {
    await sql`
      UPDATE progress SET
        glory         = ${cleanState.glory},
        total_merges  = ${cleanState.totalMerges},
        highest_tier  = ${cleanState.highestTier},
        wardog_tokens = ${safeWardog},
        warcat_tokens = ${safeWarcat},
        state         = ${JSON.stringify(cleanState)}::jsonb,
        updated_at    = NOW()
      WHERE user_id = ${userId};
    `;
  }

  if (gloryDelta > 0) {
    try {
      await addWeeklyGlory(userId, gloryDelta);
    } catch {}
    try {
      await addSeasonalGlory(userId, gloryDelta);
    } catch {}
  }
}

export async function readLeaderboard(
  limit: number,
): Promise<LeaderboardEntry[]> {
  const res = await sql`
    SELECT p.user_id, p.glory, p.highest_tier, p.total_merges,
           u.username, u.first_name
    FROM progress p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.glory DESC, p.total_merges DESC, p.user_id ASC
    LIMIT ${limit}
  `;
  return res.rows.map((row, i) => ({
    rank: i + 1,
    userId: Number(row.user_id),
    username: (row.username as string | null) ?? null,
    firstName: (row.first_name as string | null) ?? null,
    glory: Number(row.glory),
    highestTier: Number(row.highest_tier),
    totalMerges: Number(row.total_merges),
  }));
}
