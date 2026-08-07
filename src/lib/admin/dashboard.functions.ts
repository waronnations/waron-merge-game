// src/lib/admin/dashboard.functions.ts
/**
 * Admin dashboard stats server function.
 * All mutations require a valid admin session (wallet in ADMIN_WALLETS).
 * Re-exported from @/lib/admin.functions.
 */

import { createServerFn } from "@tanstack/react-start";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import {
  requireAdmin,
  getAdminDashboardStats,
} from "@/lib/admin.server";

// ─── Dashboard ─────────────────────────────────────────────────────

export const getAdminDashboardStatsFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) throw new Error("database_unavailable");
  await ensureSchema();
  await requireAdmin();
  return getAdminDashboardStats();
});
