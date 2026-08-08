// src/lib/admin/users.server.ts
/**
 * Admin user management (search, inspect, tokens, glory, bans, resets).
 * Server-only. Re-exported from @/lib/admin.server.
 */

import { sql } from "@/lib/db.server";
import { loadProgress, writeProgress } from "@/lib/game.server";
import { logNationEvent } from "@/lib/nations/history.server";
import { getMyNation } from "@/lib/nations/list.server";
import { recalculateReputation } from "@/lib/nations/reputation.server";
import { addTokens } from "@/lib/tokens";
import { type AdminContext, logAdminAction } from "./auth.server";

// ─── Users ─────────────────────────────────────────────────────────

export async function adminSearchUsers(query: string, limit = 50) {
  const q = query.trim();
  if (!q) {
    const res = await sql`
      SELECT u.id, u.telegram_id, u.username, u.first_name, u.last_name,
             u.wallet_address, u.is_traitor, u.is_banned, u.is_admin,
             u.nation_id, u.created_at, u.last_login_at,
             p.glory, p.total_merges, p.highest_tier,
             p.wardog_tokens, p.warcat_tokens,
             n.name AS nation_name, n.tag AS nation_tag
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id
      LEFT JOIN nations n ON n.id = u.nation_id
      ORDER BY u.last_login_at DESC NULLS LAST
      LIMIT ${limit}
    `;
    return res.rows.map(mapUserRow);
  }

  if (/^\d+$/.test(q)) {
    const res = await sql`
      SELECT u.id, u.telegram_id, u.username, u.first_name, u.last_name,
             u.wallet_address, u.is_traitor, u.is_banned, u.is_admin,
             u.nation_id, u.created_at, u.last_login_at,
             p.glory, p.total_merges, p.highest_tier,
             p.wardog_tokens, p.warcat_tokens,
             n.name AS nation_name, n.tag AS nation_tag
      FROM users u
      LEFT JOIN progress p ON p.user_id = u.id
      LEFT JOIN nations n ON n.id = u.nation_id
      WHERE u.id = ${Number(q)} OR u.telegram_id = ${Number(q)}
      LIMIT ${limit}
    `;
    if (res.rows.length > 0) return res.rows.map(mapUserRow);
  }

  const res = await sql`
    SELECT u.id, u.telegram_id, u.username, u.first_name, u.last_name,
           u.wallet_address, u.is_traitor, u.is_banned, u.is_admin,
           u.nation_id, u.created_at, u.last_login_at,
           p.glory, p.total_merges, p.highest_tier,
           p.wardog_tokens, p.warcat_tokens,
           n.name AS nation_name, n.tag AS nation_tag
    FROM users u
    LEFT JOIN progress p ON p.user_id = u.id
    LEFT JOIN nations n ON n.id = u.nation_id
    WHERE u.username ILIKE ${"%" + q + "%"}
       OR u.first_name ILIKE ${"%" + q + "%"}
       OR u.wallet_address ILIKE ${"%" + q + "%"}
       OR u.referral_code ILIKE ${"%" + q + "%"}
    ORDER BY u.last_login_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return res.rows.map(mapUserRow);
}

function mapUserRow(r: Record<string, unknown>) {
  return {
    id: Number(r.id),
    telegramId: Number(r.telegram_id),
    username: (r.username as string) ?? null,
    firstName: (r.first_name as string) ?? null,
    lastName: (r.last_name as string) ?? null,
    walletAddress: (r.wallet_address as string) ?? null,
    isTraitor: Boolean(r.is_traitor),
    isBanned: Boolean(r.is_banned),
    isAdmin: Boolean(r.is_admin),
    nationId: r.nation_id ? Number(r.nation_id) : null,
    nationName: (r.nation_name as string) ?? null,
    nationTag: (r.nation_tag as string) ?? null,
    createdAt: String(r.created_at),
    lastLoginAt: r.last_login_at ? String(r.last_login_at) : null,
    glory: Number(r.glory ?? 0),
    totalMerges: Number(r.total_merges ?? 0),
    highestTier: Number(r.highest_tier ?? 1),
    wardogTokens: Number(r.wardog_tokens ?? 0),
    warcatTokens: Number(r.warcat_tokens ?? 0),
  };
}

export async function adminGetUser(userId: number) {
  const res = await sql`
    SELECT u.id, u.telegram_id, u.username, u.first_name, u.last_name,
           u.photo_url, u.wallet_address, u.referral_code, u.referred_by,
           u.is_traitor, u.traitor_since, u.traitor_reason,
           u.is_banned, u.is_admin, u.is_terrorist,
           u.nation_id, u.created_at, u.last_login_at,
           p.glory, p.total_merges, p.highest_tier,
           p.wardog_tokens, p.warcat_tokens, p.state, p.last_sync_at,
           n.name AS nation_name, n.tag AS nation_tag, n.emblem AS nation_emblem
    FROM users u
    LEFT JOIN progress p ON p.user_id = u.id
    LEFT JOIN nations n ON n.id = u.nation_id
    WHERE u.id = ${userId}
    LIMIT 1
  `;
  const r = res.rows[0];
  if (!r) return null;

  const ledRes = await sql`
    SELECT id, name, tag, emblem, member_count
    FROM nations WHERE leader_id = ${userId}
  `;

  return {
    ...mapUserRow(r),
    photoUrl: (r.photo_url as string) ?? null,
    referralCode: (r.referral_code as string) ?? null,
    referredBy: r.referred_by ? Number(r.referred_by) : null,
    traitorSince: r.traitor_since ? String(r.traitor_since) : null,
    traitorReason: (r.traitor_reason as string) ?? null,
    isTerrorist: Boolean(r.is_terrorist),
    state: r.state ?? {},
    lastSyncAt: r.last_sync_at ? String(r.last_sync_at) : null,
    nationEmblem: (r.nation_emblem as string) ?? null,
    leaderships: ledRes.rows.map((n) => ({
      id: Number(n.id),
      name: String(n.name),
      tag: String(n.tag),
      emblem: String(n.emblem),
      memberCount: Number(n.member_count),
    })),
  };
}

export async function adminUpdateUserTokens(
  admin: AdminContext,
  userId: number,
  wardogDelta: number,
  warcatDelta: number,
  reason: string,
) {
  const prog = await loadProgress(userId);
  if (!prog) throw new Error("no_progress");

  const newWardog = addTokens(Number(prog.wardog_tokens), wardogDelta);
  const newWarcat = addTokens(Number(prog.warcat_tokens), warcatDelta);

  if (newWardog < 0 || newWarcat < 0) throw new Error("insufficient_tokens");

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

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "update_tokens",
    targetType: "user",
    targetId: userId,
    details: { wardogDelta, warcatDelta, newWardog, newWarcat },
    reason,
  });

  return adminGetUser(userId);
}

export async function adminUpdateUserGlory(
  admin: AdminContext,
  userId: number,
  gloryDelta: number,
  reason: string,
) {
  await sql`
    UPDATE progress
    SET glory = GREATEST(0, glory + ${gloryDelta}),
        updated_at = NOW()
    WHERE user_id = ${userId}
  `;

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "update_glory",
    targetType: "user",
    targetId: userId,
    details: { gloryDelta },
    reason,
  });

  return adminGetUser(userId);
}

export async function adminClearTraitor(
  admin: AdminContext,
  userId: number,
  reason: string,
) {
  await sql`
    UPDATE users
    SET is_traitor = FALSE,
        traitor_since = NULL,
        traitor_reason = NULL
    WHERE id = ${userId}
  `;

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "clear_traitor",
    targetType: "user",
    targetId: userId,
    details: {},
    reason,
  });

  return adminGetUser(userId);
}

export async function adminSetBanned(
  admin: AdminContext,
  userId: number,
  banned: boolean,
  reason: string,
) {
  await sql`
    UPDATE users SET is_banned = ${banned} WHERE id = ${userId}
  `;

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: banned ? "ban_user" : "unban_user",
    targetType: "user",
    targetId: userId,
    details: { banned },
    reason,
  });

  return adminGetUser(userId);
}

export async function adminForceLeaveNation(
  admin: AdminContext,
  userId: number,
  reason: string,
) {
  const my = await getMyNation(userId);

  const led = await sql`SELECT id FROM nations WHERE leader_id = ${userId}`;
  for (const row of led.rows) {
    const nid = Number(row.id);
    await sql`
      UPDATE nations
      SET leader_id = NULL, listed_price = NULL, listed_at = NULL,
          member_count = (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${nid} AND user_id != ${userId})
      WHERE id = ${nid}
    `;
    await logNationEvent(nid, userId, "admin_force_leave", { adminWallet: admin.wallet });
    await recalculateReputation(nid);
  }

  await sql`DELETE FROM nation_members WHERE user_id = ${userId}`;
  await sql`UPDATE users SET nation_id = NULL WHERE id = ${userId}`;

  if (my) {
    await sql`
      UPDATE nations
      SET member_count = (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${my.id})
      WHERE id = ${my.id}
    `;
    await recalculateReputation(my.id);
  }

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "force_leave_nation",
    targetType: "user",
    targetId: userId,
    details: { previousNationId: my?.id ?? null, clearedLeaderships: led.rows.length },
    reason,
  });

  return adminGetUser(userId);
}

export async function adminResetBoard(
  admin: AdminContext,
  userId: number,
  reason: string,
) {
  const prog = await loadProgress(userId);
  if (!prog) throw new Error("no_progress");

  const state = { ...(prog.state as any) };
  state.board = Array(36).fill(null);
  state.energy = 100;

  await writeProgress(userId, state, { touchSyncClock: false });

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "reset_board",
    targetType: "user",
    targetId: userId,
    details: {},
    reason,
  });

  return adminGetUser(userId);
}
