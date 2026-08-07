// src/lib/admin/logs.server.ts
/**
 * Admin audit-log viewer.
 * Server-only. Re-exported from @/lib/admin.server.
 */

import { sql } from "@/lib/db.server";

// ─── Audit log viewer ──────────────────────────────────────────────

export async function adminGetAuditLog(limit = 100, offset = 0) {
  const res = await sql`
    SELECT id, admin_wallet, admin_user_id, action, target_type, target_id,
           details, reason, ip, user_agent, created_at
    FROM admin_audit_log
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return res.rows.map((r) => ({
    id: Number(r.id),
    adminWallet: String(r.admin_wallet),
    adminUserId: r.admin_user_id ? Number(r.admin_user_id) : null,
    action: String(r.action),
    targetType: (r.target_type as string) ?? null,
    targetId: (r.target_id as string) ?? null,
    details: r.details ?? {},
    reason: (r.reason as string) ?? null,
    ip: (r.ip as string) ?? null,
    userAgent: (r.user_agent as string) ?? null,
    createdAt: String(r.created_at),
  }));
}
