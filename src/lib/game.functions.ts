// src/lib/game.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import {
  LeaderboardInput,
  StateSchema,
  loadProgress,
  readLeaderboard,
  requireUserId,
  validateTransition,
  writeProgress,
  serverPurchaseShopItem,
  serverRecoverEnergy,
  serverClaimDaily,
  serverClaimTask,
  serverClaimDailyQuest,
  serverLaunchNuke,
  serverCommitMerge,
  serverCommitSpawn,
  serverCommitSwap,
  serverResolveHybrid,
  serverCompleteHybridWithArt,
  serverSacrificeBoardHybrid,
  type LeaderboardEntry,
  type ShopItemIdServer,
} from "@/lib/game.server";
import { serverCommitDeploy } from "@/lib/game/server/war-mode.server";

export type { LeaderboardEntry, ServerGameState } from "@/lib/game.server";

const PayTokenSchema = z.enum(["wardog", "warcat"]);

export const getProgress = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!hasDatabase()) return { available: false as const };
    await ensureSchema();
    const userId = await requireUserId();
    const row = await loadProgress(userId);
    // Never-synced row has empty JSONB: return null so client seeds on first sync.
    const state = row && !row.stateEmpty ? row.state : null;
    return { available: true as const, state };
  },
);

export const syncProgress = createServerFn({ method: "POST" })
  .validator((input: unknown) => StateSchema.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();

    assertRateLimit(`sync:${userId}`, 40, 60_000);

    const prev = await loadProgress(userId);

    let payload = data;
    if (prev && !prev.stateEmpty) {
      // Never reject play because server economy is ahead of local board play.
      payload = {
        ...data,
        glory: Math.max(Number(data.glory) || 0, Number(prev.glory) || 0),
        totalMerges: Math.max(
          Number(data.totalMerges) || 0,
          Number(prev.total_merges) || 0,
        ),
        highestTier: Math.max(
          Number(data.highestTier) || 1,
          Number(prev.highest_tier) || 1,
        ),
        wardogTokens: Math.max(
          Number(data.wardogTokens) || 0,
          Number(prev.wardog_tokens) || 0,
        ),
        warcatTokens: Math.max(
          Number(data.warcatTokens) || 0,
          Number(prev.warcat_tokens) || 0,
        ),
      };

      const prevMerges = prev.total_merges;
      const nextMerges = payload.totalMerges;

      const prevUnits = Array.isArray((prev.state as any)?.board)
        ? (prev.state as any).board.filter(Boolean).length
        : 0;
      const nextUnits = Array.isArray(payload.board)
        ? payload.board.filter(Boolean).length
        : 0;

      // Block inventing units without merge growth.
      // Allow fewer units when glory rose (sacrifice / cleanup).
      if (nextMerges <= prevMerges && nextUnits > prevUnits) {
        const prevState = prev.state as Record<string, unknown>;
        payload = {
          ...payload,
          board: (prevState.board as typeof data.board) ?? payload.board,
          nextId: Math.max(
            payload.nextId,
            Number(prevState.nextId ?? payload.nextId),
          ),
          pendingHybrid:
            (prevState.pendingHybrid as typeof data.pendingHybrid) ??
            payload.pendingHybrid,
          hybrids:
            (prevState.hybrids as typeof data.hybrids) ?? payload.hybrids,
          explosion:
            (prevState.explosion as typeof data.explosion) ??
            payload.explosion,
        };
      }

      const verdict = validateTransition(prev, payload, Date.now());
      if (!verdict.ok) return { ok: false as const, reason: verdict.reason };
    }

    const gloryDelta = prev
      ? Math.max(0, payload.glory - prev.glory)
      : payload.glory;

    await writeProgress(userId, payload, {
      touchSyncClock: true,
      gloryDelta,
    });
    return { ok: true as const };
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .validator((input: unknown) => LeaderboardInput.parse(input ?? {}))
  .handler(async ({ data }): Promise<LeaderboardEntry[]> => {
    if (!hasDatabase()) return [];
    await ensureSchema();
    return readLeaderboard(data.limit);
  });

/**
 * Purchase a shop item.
 * Spend the full cost from the chosen token only (WARDOG or WARCAT).
 */
export const purchaseShopItem = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        itemId: z.enum(["energyPack", "gloryBoost", "nukePack"]),
        payWith: PayTokenSchema.default("wardog"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`shop:${userId}`, 20, 60_000);
    return serverPurchaseShopItem(
      userId,
      data.itemId as ShopItemIdServer,
      data.payWith,
    );
  });

/**
 * Board energy recovery.
 * Spend from the chosen token only (WARDOG or WARCAT). Never TON.
 * clientEnergy = what the Mini App currently shows (fixes local-first desync).
 */
export const recoverEnergy = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        payWith: PayTokenSchema.default("wardog"),
        clientEnergy: z.number().min(0).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`recover:${userId}`, 15, 60_000);
    return serverRecoverEnergy(userId, data.payWith, data.clientEnergy);
  });

export const claimDaily = createServerFn({ method: "POST" }).handler(
  async () => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`claimDaily:${userId}`, 5, 60_000);
    return serverClaimDaily(userId);
  },
);

export const claimTask = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ taskId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`claimTask:${userId}`, 20, 60_000);
    return serverClaimTask(userId, data.taskId);
  });

export const claimDailyQuest = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ questId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`claimQuest:${userId}`, 20, 60_000);
    return serverClaimDailyQuest(userId, data.questId);
  });

/**
 * Launch a Strategic Nuke against a nation.
 * Soft rate limit (60/min) stops pure spam, not normal play.
 */
export const launchNuke = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        targetNationId: z.number().int().positive(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nuke:${userId}`, 60, 60_000);
    return serverLaunchNuke(userId, data.targetNationId);
  });

/** @deprecated – old free nuke. Kept so old clients don't crash. */
export const useNuke = createServerFn({ method: "POST" }).handler(async () => {
  return {
    ok: false as const,
    reason: "deprecated_use_launchNuke",
  };
});

export const commitMerge = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        from: z.number().int().min(0).max(35),
        to: z.number().int().min(0).max(35),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`merge:${userId}`, 60, 60_000);
    return serverCommitMerge(userId, data.from, data.to);
  });

/** Accept client placement so local + server boards stay in sync. */
export const commitSpawn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        targetIdx: z.number().int().min(0).max(35).optional(),
        faction: z.enum(["dog", "cat"]).optional(),
      })
      .optional()
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`spawn:${userId}`, 30, 60_000);
    return serverCommitSpawn(userId, {
      targetIdx: data?.targetIdx,
      faction: data?.faction,
    });
  });

export const commitSwap = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        from: z.number().int().min(0).max(35),
        to: z.number().int().min(0).max(35),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`swap:${userId}`, 40, 60_000);
    return serverCommitSwap(userId, data.from, data.to);
  });

/**
 * Server-authoritative War Mode deploy / Live Target attack.
 * Enforces adversary-only side rules.
 */
export const commitDeploy = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        index: z.number().int().min(0).max(35),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`deploy:${userId}`, 30, 60_000);
    return serverCommitDeploy(userId, data.index);
  });

export const resolveHybrid = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        choice: z.enum(["sacrifice", "keep"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`hybrid:${userId}`, 10, 60_000);
    return serverResolveHybrid(userId, data.choice);
  });

/**
 * Sacrifice a hybrid already on the board.
 * Dedicated commit — forceSync cannot clear board without a merge increase.
 */
export const sacrificeBoardHybrid = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ idx: z.number().int().min(0).max(35) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`hybridSac:${userId}`, 15, 60_000);
    return serverSacrificeBoardHybrid(userId, data.idx);
  });

export const completeHybridWithArt = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        imageUrl: z.string().url().max(2048),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase())
      return { ok: false as const, reason: "database_not_configured" };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`hybridArt:${userId}`, 8, 60_000);
    return serverCompleteHybridWithArt(userId, data.imageUrl);
  });
