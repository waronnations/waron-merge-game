// src/lib/admin/economy.functions.ts
/**
 * Admin economy server functions (claims, shop ledger).
 * All mutations require a valid admin session (wallet in ADMIN_WALLETS).
 * Re-exported from @/lib/admin.functions.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import {
  requireAdmin,
  adminListClaims,
  adminMarkClaimSent,
  adminMarkClaimFailed,
  adminRefundClaim,
  adminListShopLedger,
} from "@/lib/admin.server";

// ─── Economy & Claims ──────────────────────────────────────────────

export const adminListClaimsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        status: z
          .enum(["pending", "sent", "failed", "refunded", "all"])
          .optional()
          .default("all"),
        limit: z.number().int().min(1).max(200).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    await requireAdmin();
    return adminListClaims(data.status, data.limit, data.offset);
  });

export const adminMarkClaimSentFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        claimId: z.number().int().positive(),
        txHash: z.string().min(1).max(200),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:claimsent:${admin.wallet}`, 30, 60_000);
    return adminMarkClaimSent(admin, data.claimId, data.txHash, data.reason);
  });

export const adminMarkClaimFailedFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        claimId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:claimfailed:${admin.wallet}`, 20, 60_000);
    return adminMarkClaimFailed(admin, data.claimId, data.reason);
  });

export const adminRefundClaimFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        claimId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    const admin = await requireAdmin();
    assertRateLimit(`admin:claimrefund:${admin.wallet}`, 20, 60_000);
    return adminRefundClaim(admin, data.claimId, data.reason);
  });

export const adminListShopLedgerFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    await requireAdmin();
    return adminListShopLedger(data.limit, data.offset);
  });
