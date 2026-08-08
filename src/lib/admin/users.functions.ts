// src/lib/admin/users.functions.ts
/**
 * Admin user-management server functions.
 * All mutations require a valid admin session (wallet in ADMIN_WALLETS).
 * Re-exported from @/lib/admin.functions.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import {
  requireAdmin,
  adminSearchUsers,
  adminGetUser,
  adminUpdateUserTokens,
  adminUpdateUserGlory,
  adminClearTraitor,
  adminSetBanned,
  adminForceLeaveNation,
  adminResetBoard,
} from "@/lib/admin.server";

// ─── Users ─────────────────────────────────────────────────────────

export const adminSearchUsersFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        query: z.string().optional().default(""),
        limit: z.number().int().min(1).max(200).optional().default(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    await requireAdmin();
    return adminSearchUsers(data.query, data.limit);
  });

export const adminGetUserFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ userId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    await requireAdmin();
    return adminGetUser(data.userId);
  });

export const adminUpdateUserTokensFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        userId: z.number().int().positive(),
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
    assertRateLimit(`admin:tokens:${admin.wallet}`, 30, 60_000);
    return adminUpdateUserTokens(
      admin,
      data.userId,
      data.wardogDelta,
      data.warcatDelta,
      data.reason,
    );
  });

export const adminUpdateUserGloryFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        userId: z.number().int().positive(),
        gloryDelta: z.number(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:glory:${admin.wallet}`, 30, 60_000);
    return adminUpdateUserGlory(admin, data.userId, data.gloryDelta, data.reason);
  });

export const adminClearTraitorFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        userId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:traitor:${admin.wallet}`, 20, 60_000);
    return adminClearTraitor(admin, data.userId, data.reason);
  });

export const adminSetBannedFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        userId: z.number().int().positive(),
        banned: z.boolean(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:ban:${admin.wallet}`, 20, 60_000);
    return adminSetBanned(admin, data.userId, data.banned, data.reason);
  });

export const adminForceLeaveNationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        userId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:forceleave:${admin.wallet}`, 20, 60_000);
    return adminForceLeaveNation(admin, data.userId, data.reason);
  });

export const adminResetBoardFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        userId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:resetboard:${admin.wallet}`, 15, 60_000);
    return adminResetBoard(admin, data.userId, data.reason);
  });
