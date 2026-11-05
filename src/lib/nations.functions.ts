// src/lib/nations.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import {
  requireUserId,
  getMyNation,
  listNations,
  joinNation,
  leaveNation,
  getNationLeaderboard,
  getNationMembers,
  getNationDetails,
  transferNationOwnership,
  listNationForSale,
  unlistNation,
  buyNation,
  donateToVault,
  activateNationBuff,
  promoteOfficer,
  demoteOfficer,
  activateProtection,
  setRedemptionPrice,
  redeemTraitor,
} from "@/lib/nations.server";
import { getRecentStrikes, seedCountryNations } from "@/lib/nations/list.server";
import { kickMember } from "@/lib/nations/membership.server";
import { listNationHistory } from "@/lib/nations/history.server";
import { assertRateLimit } from "@/lib/rate-limit.server";

const PayTokenSchema = z.enum(["wardog", "warcat"]);

/** Enough for all COUNTRY_NATIONS (~209) + DOG/CAT hubs */
const FULL_NATION_LIMIT = 300;

export const getMyNationFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) return null;
  await ensureSchema();
  return getMyNation(await requireUserId());
});

export const listNationsFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) return [];
  await ensureSchema();
  await seedCountryNations();
  return listNations(FULL_NATION_LIMIT);
});

export const getRecentStrikesFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) return [];
  await ensureSchema();
  return getRecentStrikes(8);
});

export const getNationDetailsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ nationId: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return null;
    await ensureSchema();
    let userId: number | null = null;
    try {
      userId = await requireUserId();
    } catch {
      /* guest */
    }
    return getNationDetails(userId, data.nationId);
  });

export const joinNationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        acceptContribution: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:join:${userId}`, 5, 60_000);
    return joinNation(userId, data.nationId, data.acceptContribution);
  });

export const leaveNationFn = createServerFn({ method: "POST" }).handler(async () => {
  if (!hasDatabase()) throw new Error("database_unavailable");
  await ensureSchema();
  const userId = await requireUserId();
  assertRateLimit(`nation:leave:${userId}`, 5, 60_000);
  return leaveNation(userId);
});

export const transferOwnershipFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ toUserId: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:transfer:${userId}`, 3, 5 * 60_000);
    return transferNationOwnership(userId, data.toUserId);
  });

export const listNationForSaleFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ price: z.number().positive().max(10000) }).parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:list:${userId}`, 5, 5 * 60_000);
    return listNationForSale(userId, data.price);
  });

export const unlistNationFn = createServerFn({ method: "POST" }).handler(async () => {
  if (!hasDatabase()) throw new Error("database_unavailable");
  await ensureSchema();
  const userId = await requireUserId();
  assertRateLimit(`nation:unlist:${userId}`, 5, 5 * 60_000);
  return unlistNation(userId);
});

/**
 * Buy a listed nation.
 * Full price (+ tax) is taken from the chosen token only — never TON.
 */
export const buyNationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        payWith: PayTokenSchema.default("wardog"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:buy:${userId}`, 3, 5 * 60_000);
    return buyNation(userId, data.nationId, data.payWith);
  });

export const getNationLeaderboardFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) return [];
  await ensureSchema();
  // Seed any missing countries so BASE Country Rank is complete
  await seedCountryNations();
  return getNationLeaderboard(FULL_NATION_LIMIT);
});

export const getNationMembersFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ nationId: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return [];
    await ensureSchema();
    return getNationMembers(data.nationId, 50);
  });

export const donateToVaultFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        wardog: z.number().min(0).max(10000).default(0),
        warcat: z.number().min(0).max(10000).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:donate:${userId}`, 10, 60_000);
    return donateToVault(userId, data.nationId, data.wardog, data.warcat);
  });

export const activateNationBuffFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ buffId: z.enum(["gloryBoost", "energySurge"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:buff:${userId}`, 5, 5 * 60_000);
    return activateNationBuff(userId, data.buffId);
  });

export const promoteOfficerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ toUserId: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:promote:${userId}`, 5, 5 * 60_000);
    return promoteOfficer(userId, data.toUserId);
  });

export const demoteOfficerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ toUserId: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:demote:${userId}`, 5, 5 * 60_000);
    return demoteOfficer(userId, data.toUserId);
  });

// ── Phase 1: Protection & Traitor Redemption ───────────────────

export const activateProtectionFn = createServerFn({ method: "POST" }).handler(async () => {
  if (!hasDatabase()) throw new Error("database_unavailable");
  await ensureSchema();
  const userId = await requireUserId();
  assertRateLimit(`nation:protect:${userId}`, 3, 5 * 60_000);
  return activateProtection(userId);
});

export const setRedemptionPriceFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        wardog: z.number().min(0).max(200),
        warcat: z.number().min(0).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:redemption:${userId}`, 5, 5 * 60_000);
    return setRedemptionPrice(userId, data.wardog, data.warcat);
  });

/**
 * Clear traitor status.
 * pay=true → spend redemption price from chosen token (payWith).
 * pay=false → free after cooldown.
 */
export const redeemTraitorFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        pay: z.boolean(),
        payWith: PayTokenSchema.optional().default("wardog"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:redeem:${userId}`, 5, 5 * 60_000);
    return redeemTraitor(userId, data.pay, data.payWith);
  });

/** Ownership + governance audit trail for a nation. */
export const getNationHistoryFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ nationId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) return [];
    await ensureSchema();
    await requireUserId();
    return listNationHistory(data.nationId, 25);
  });

/** Governance: leader removes a member. */
export const kickMemberFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ targetUserId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`nation:kick:${userId}`, 10, 5 * 60_000);
    return kickMember(userId, data.targetUserId);
  });
