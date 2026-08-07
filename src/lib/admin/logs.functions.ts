// src/lib/admin/logs.functions.ts
/**
 * Admin audit-log server function.
 * All mutations require a valid admin session (wallet in ADMIN_WALLETS).
 * Re-exported from @/lib/admin.functions.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import {
  requireAdmin,
  adminGetAuditLog,
} from "@/lib/admin.server";

// ─── Audit Log ─────────────────────────────────────────────────────

export const adminGetAuditLogFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).optional().default(100),
        offset: z.number().int().min(0).optional().default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    await requireAdmin();
    return adminGetAuditLog(data.limit, data.offset);
  });
