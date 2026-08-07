// src/lib/admin/auth.functions.ts
/**
 * Admin auth server functions (session, login, logout).
 * All mutations require a valid admin session (wallet in ADMIN_WALLETS).
 * Re-exported from @/lib/admin.functions.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import {
  adminLogin,
  adminLogout,
  getAdminSession,
} from "@/lib/admin.server";

// ─── Auth ──────────────────────────────────────────────────────────

export const getAdminSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) return { isAdmin: false, wallet: null, userId: null };
  await ensureSchema();
  return getAdminSession();
});

export const adminLoginFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ wallet: z.string().min(10).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    await ensureSchema();
    assertRateLimit(`admin:login:${data.wallet}`, 10, 60_000);
    return adminLogin(data.wallet);
  });

export const adminLogoutFn = createServerFn({ method: "POST" }).handler(async () => {
  if (!hasDatabase()) throw new Error("database_unavailable");
  await ensureSchema();
  return adminLogout();
});
