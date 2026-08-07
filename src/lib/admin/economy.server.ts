// src/lib/admin/economy.server.ts
/**
 * Admin economy: claims moderation and shop ledger.
 * Server-only. Re-exported from @/lib/admin.server.
 */

import { sql } from "@/lib/db.server";
import { loadProgress, writeProgress } from "@/lib/game.server";
import { addTokens } from "@/lib/tokens";
import { type AdminContext, logAdminAction } from "./auth.server";

// ═══════════════════════════════════════════════════════════════════
// Economy & Claims
// ═══════════════════════════════════════════════════════════════════

export async function adminListClaims(
  status: "pending" | "sent" | "failed" | "refunded" | "all" = "all",
  limit = 50,
  offset = 0,
) {
  const res =
    status === "all"
      ? await sql`
          SELECT c.id, c.user_id, c.token, c.amount, c.status, c.wallet_address,
                 c.tx_hash, c.created_at, c.updated_at,
                 u.username, u.first_name, u.telegram_id
          FROM claims c
          JOIN users u ON u.id = c.user_id
          ORDER BY c.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT c.id, c.user_id, c.token, c.amount, c.status, c.wallet_address,
                 c.tx_hash, c.created_at, c.updated_at,
                 u.username, u.first_name, u.telegram_id
          FROM claims c
          JOIN users u ON u.id = c.user_id
          WHERE c.status = ${status}
          ORDER BY c.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

  return res.rows.map((r) => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    telegramId: Number(r.telegram_id),
    username: (r.username as string) ?? null,
    firstName: (r.first_name as string) ?? null,
    token: r.token as "wardog" | "warcat",
    amount: Number(r.amount),
    status: r.status as "pending" | "sent" | "failed" | "refunded",
    walletAddress: String(r.wallet_address),
    txHash: (r.tx_hash as string) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function adminMarkClaimSent(
  admin: AdminContext,
  claimId: number,
  txHash: string,
  reason: string,
) {
  const res = await sql`
    UPDATE claims
    SET status = 'sent',
        tx_hash = ${txHash.trim()},
        updated_at = NOW()
    WHERE id = ${claimId} AND status = 'pending'
    RETURNING id, user_id, token, amount, wallet_address
  `;
  if (!res.rowCount) throw new Error("claim_not_found_or_not_pending");

  const row = res.rows[0];

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "claim_mark_sent",
    targetType: "claim",
    targetId: claimId,
    details: {
      userId: Number(row.user_id),
      token: row.token,
      amount: Number(row.amount),
      txHash: txHash.trim(),
      wallet: row.wallet_address,
    },
    reason,
  });

  return { ok: true as const };
}

export async function adminMarkClaimFailed(
  admin: AdminContext,
  claimId: number,
  reason: string,
) {
  const res = await sql`
    UPDATE claims
    SET status = 'failed',
        updated_at = NOW()
    WHERE id = ${claimId} AND status = 'pending'
    RETURNING id, user_id, token, amount
  `;
  if (!res.rowCount) throw new Error("claim_not_found_or_not_pending");

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "claim_mark_failed",
    targetType: "claim",
    targetId: claimId,
    details: {
      userId: Number(res.rows[0].user_id),
      token: res.rows[0].token,
      amount: Number(res.rows[0].amount),
    },
    reason,
  });

  return { ok: true as const };
}

export async function adminRefundClaim(
  admin: AdminContext,
  claimId: number,
  reason: string,
) {
  const claimRes = await sql`
    SELECT id, user_id, token, amount, status
    FROM claims WHERE id = ${claimId} LIMIT 1
  `;
  const claim = claimRes.rows[0];
  if (!claim) throw new Error("claim_not_found");
  if (claim.status !== "pending" && claim.status !== "failed") {
    throw new Error("claim_not_refundable");
  }

  const userId = Number(claim.user_id);
  const token = claim.token as "wardog" | "warcat";
  const amount = Number(claim.amount);

  const prog = await loadProgress(userId);
  if (!prog) throw new Error("no_progress");

  const newWardog =
    token === "wardog"
      ? addTokens(Number(prog.wardog_tokens), amount)
      : Number(prog.wardog_tokens);
  const newWarcat =
    token === "warcat"
      ? addTokens(Number(prog.warcat_tokens), amount)
      : Number(prog.warcat_tokens);

  const newState = {
    ...(prog.state as any),
    wardogTokens: newWardog,
    warcatTokens: newWarcat,
  };
  await writeProgress(userId, newState, { touchSyncClock: false });

  await sql`
    UPDATE progress
    SET wardog_tokens = ${newWardog},
        warcat_tokens = ${newWarcat},
        updated_at = NOW()
    WHERE user_id = ${userId}
  `;

  await sql`
    UPDATE claims
    SET status = 'refunded',
        updated_at = NOW()
    WHERE id = ${claimId}
  `;

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "claim_refund",
    targetType: "claim",
    targetId: claimId,
    details: { userId, token, amount },
    reason,
  });

  return { ok: true as const };
}

export async function adminListShopLedger(limit = 50, offset = 0) {
  const res = await sql`
    SELECT s.id, s.user_id, s.item_id, s.cost, s.created_at,
           u.username, u.first_name, u.telegram_id
    FROM shop_ledger s
    JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return res.rows.map((r) => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    telegramId: Number(r.telegram_id),
    username: (r.username as string) ?? null,
    firstName: (r.first_name as string) ?? null,
    itemId: String(r.item_id),
    cost: Number(r.cost),
    createdAt: String(r.created_at),
  }));
}
