// src/lib/admin/auth.server.ts
/**
 * Admin auth: wallet allowlist, session login/logout and audit logging.
 * Server-only. Re-exported from @/lib/admin.server.
 */

import { sql } from "@/lib/db.server";
import { readSession, mutableSession, type WonSession } from "@/lib/session.server";

// ─── Env helpers ───────────────────────────────────────────────────

function getAdminWallets(): string[] {
  const raw = process.env.ADMIN_WALLETS || "";
  return raw
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

export function isWalletAllowed(wallet: string | null | undefined): boolean {
  if (!wallet) return false;
  const normalized = wallet.trim().toLowerCase();
  const allowed = getAdminWallets();
  return allowed.length > 0 && allowed.includes(normalized);
}

// ─── Auth ──────────────────────────────────────────────────────────

export interface AdminContext {
  wallet: string;
  userId: number | null;
}

export async function requireAdmin(): Promise<AdminContext> {
  const session = await readSession();
  const data = session.data as WonSession | undefined;

  if (!data?.isAdmin || !data.adminWallet) {
    throw new Error("unauthorized_admin");
  }

  if (!isWalletAllowed(data.adminWallet)) {
    throw new Error("unauthorized_admin");
  }

  return {
    wallet: data.adminWallet,
    userId: data.userId ?? null,
  };
}

export async function adminLogin(wallet: string): Promise<{ ok: true; wallet: string }> {
  const normalized = wallet.trim();
  if (!isWalletAllowed(normalized)) {
    throw new Error("wallet_not_allowed");
  }

  const userRes = await sql`
    SELECT id FROM users
    WHERE LOWER(wallet_address) = ${normalized.toLowerCase()}
    LIMIT 1
  `;
  const linkedUserId = userRes.rows[0] ? Number(userRes.rows[0].id) : null;

  const session = await mutableSession();
  await session.update({
    isAdmin: true,
    adminWallet: normalized,
    userId: linkedUserId ?? undefined,
  });

  await logAdminAction({
    adminWallet: normalized,
    adminUserId: linkedUserId,
    action: "admin_login",
    targetType: "system",
    targetId: null,
    details: { linkedUserId },
    reason: null,
  });

  return { ok: true, wallet: normalized };
}

export async function adminLogout(): Promise<{ ok: true }> {
  const session = await readSession();
  const data = session.data as WonSession | undefined;
  const wallet = data?.adminWallet;

  if (wallet) {
    await logAdminAction({
      adminWallet: wallet,
      adminUserId: data?.userId ?? null,
      action: "admin_logout",
      targetType: "system",
      targetId: null,
      details: {},
      reason: null,
    });
  }

  const mutable = await mutableSession();
  await mutable.update({
    isAdmin: false,
    adminWallet: undefined,
  });

  return { ok: true };
}

export async function getAdminSession(): Promise<{
  isAdmin: boolean;
  wallet: string | null;
  userId: number | null;
}> {
  const session = await readSession();
  const data = session.data as WonSession | undefined;

  if (!data?.isAdmin || !data.adminWallet || !isWalletAllowed(data.adminWallet)) {
    return { isAdmin: false, wallet: null, userId: null };
  }

  return {
    isAdmin: true,
    wallet: data.adminWallet,
    userId: data.userId ?? null,
  };
}

// ─── Audit logging ─────────────────────────────────────────────────

export async function logAdminAction(params: {
  adminWallet: string;
  adminUserId?: number | null;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  details?: Record<string, unknown>;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await sql`
    INSERT INTO admin_audit_log (
      admin_wallet, admin_user_id, action, target_type, target_id,
      details, reason, ip, user_agent
    )
    VALUES (
      ${params.adminWallet},
      ${params.adminUserId ?? null},
      ${params.action},
      ${params.targetType ?? null},
      ${params.targetId != null ? String(params.targetId) : null},
      ${JSON.stringify(params.details ?? {})}::jsonb,
      ${params.reason ?? null},
      ${params.ip ?? null},
      ${params.userAgent ?? null}
    )
  `;
}
