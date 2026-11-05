// src/lib/admin/nations.functions.ts
/**
 * Admin nation-management + nation detail server functions.
 * All mutations require a valid admin session (wallet in ADMIN_WALLETS).
 * Re-exported from @/lib/admin.functions.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import {
  requireAdmin,
  adminListNations,
  adminRemovePlayerFromNation,
  adminHealNations,
  adminClearNationLeader,
  adminGetNationDetails,
  adminForceTransferOwnership,
  adminUpdateNationVault,
  adminSetNationProtection,
  adminSetNationRedemptionPrice,
  adminKickNationMember,
} from "@/lib/admin.server";

// ─── Nations ───────────────────────────────────────────────────────

export const adminListNationsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).optional().default(300),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    await requireAdmin();
    return adminListNations(data.limit);
  });

export const adminRemovePlayerFromNationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        userId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:removefromnation:${admin.wallet}`, 30, 60_000);
    return adminRemovePlayerFromNation(
      admin,
      data.nationId,
      data.userId,
      data.reason,
    );
  });

export const adminHealNationsFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ reason: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:healnations:${admin.wallet}`, 5, 60_000);
    return adminHealNations(admin, data.reason);
  });

/** @deprecated → adminHealNationsFn */
export const adminClearOrphanedLeadersFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ reason: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:clearorphans:${admin.wallet}`, 5, 60_000);
    return adminHealNations(admin, data.reason);
  });

/** @deprecated → adminHealNationsFn */
export const adminFixMultiLeadersFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ reason: z.string().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:fixmultileaders:${admin.wallet}`, 5, 60_000);
    return adminHealNations(admin, data.reason);
  });

export const adminClearNationLeaderFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:clearleader:${admin.wallet}`, 20, 60_000);
    return adminClearNationLeader(admin, data.nationId, data.reason);
  });

// ─── Nation detail ─────────────────────────────────────────────────

export const adminGetNationDetailsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ nationId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    await requireAdmin();
    return adminGetNationDetails(data.nationId);
  });

export const adminForceTransferOwnershipFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        toUserId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:transfer:${admin.wallet}`, 15, 60_000);
    return adminForceTransferOwnership(
      admin,
      data.nationId,
      data.toUserId,
      data.reason,
    );
  });

export const adminUpdateNationVaultFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        wardogDelta: z.number(),
        warcatDelta: z.number(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:vault:${admin.wallet}`, 20, 60_000);
    return adminUpdateNationVault(
      admin,
      data.nationId,
      data.wardogDelta,
      data.warcatDelta,
      data.reason,
    );
  });

export const adminSetNationProtectionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        enable: z.boolean(),
        hours: z.number().min(1).max(168).optional().default(24),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:protection:${admin.wallet}`, 15, 60_000);
    return adminSetNationProtection(
      admin,
      data.nationId,
      data.enable,
      data.hours,
      data.reason,
    );
  });

export const adminSetNationRedemptionPriceFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        wardog: z.number().min(0).max(200),
        warcat: z.number().min(0).max(200),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:redemption:${admin.wallet}`, 15, 60_000);
    return adminSetNationRedemptionPrice(
      admin,
      data.nationId,
      data.wardog,
      data.warcat,
      data.reason,
    );
  });

export const adminKickNationMemberFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        nationId: z.number().int().positive(),
        userId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:kick:${admin.wallet}`, 20, 60_000);
    return adminKickNationMember(admin, data.nationId, data.userId, data.reason);
  });
