// src/lib/admin/nations.server.ts
/**
 * Admin nation management, healing and detail tools.
 * Server-only. Re-exported from @/lib/admin.server.
 */

import { sql } from "@/lib/db.server";
import { markTraitor, logNationEvent } from "@/lib/nations/history.server";
import { recalculateReputation } from "@/lib/nations/reputation.server";
import { removeUserFromNation } from "@/lib/nations/membership.server";
import { type AdminContext, logAdminAction } from "./auth.server";

// ─── Nations ───────────────────────────────────────────────────────

export async function adminListNations(limit = 300) {
  const res = await sql`
    SELECT n.id, n.name, n.tag, n.emblem, n.is_default, n.leader_id,
           n.total_glory, n.member_count, n.reputation,
           n.vault_wardog, n.vault_warcat, n.is_protected,
           n.protection_expires_at, n.listed_price,
           u.username AS leader_username, u.first_name AS leader_first_name
    FROM nations n
    LEFT JOIN users u ON u.id = n.leader_id
    ORDER BY n.is_default DESC, n.total_glory DESC
    LIMIT ${limit}
  `;
  return res.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    tag: String(r.tag),
    emblem: String(r.emblem),
    isDefault: Boolean(r.is_default),
    leaderId: r.leader_id ? Number(r.leader_id) : null,
    leaderUsername: (r.leader_username as string) ?? null,
    leaderFirstName: (r.leader_first_name as string) ?? null,
    totalGlory: Number(r.total_glory),
    memberCount: Number(r.member_count),
    reputation: Number(r.reputation ?? 0),
    vaultWardog: Number(r.vault_wardog ?? 0),
    vaultWarcat: Number(r.vault_warcat ?? 0),
    isProtected: Boolean(r.is_protected),
    protectionExpiresAt: r.protection_expires_at ? String(r.protection_expires_at) : null,
    listedPrice: r.listed_price != null ? Number(r.listed_price) : null,
  }));
}

/**
 * Precise: remove a player from ONE specified nation only.
 * Clears leader_id only if they lead THIS nation.
 * Does not touch their other nations.
 */
export async function adminRemovePlayerFromNation(
  admin: AdminContext,
  nationId: number,
  userId: number,
  reason: string,
) {
  const result = await removeUserFromNation(userId, nationId, reason);

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "remove_player_from_nation",
    targetType: "nation",
    targetId: nationId,
    details: { userId, ...result },
    reason,
  });

  return result;
}
/**
 * Full nations data heal (replaces multi-leader / orphan-only fix).
 * Multi-leader creation is already prevented in membership/ownership code.
 * This only repairs leftover bad data so Claim works on empty countries.
 *
 * Steps:
 * 1. Remove ghost nation_members (user row missing)
 * 2. Recalculate every member_count from nation_members
 * 3. Clear orphaned leader_id (leader not a member of that nation)
 * 4. Clear leader_id on empty non-default countries
 * 5. Sync users.nation_id when membership is gone
 */
export async function adminHealNations(admin: AdminContext, reason: string) {
  // 1) Ghost memberships
  const ghosts = await sql`
    DELETE FROM nation_members nm
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = nm.user_id)
    RETURNING nation_id, user_id
  `;

  // 2) Recount every nation
  await sql`
    UPDATE nations n
    SET member_count = (
      SELECT COUNT(*)::int FROM nation_members nm WHERE nm.nation_id = n.id
    )
  `;

  // 3) Orphaned leaders
  const orphaned = await sql`
    UPDATE nations n
    SET leader_id = NULL,
        listed_price = NULL,
        listed_at = NULL
    WHERE n.leader_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM nation_members nm
        WHERE nm.nation_id = n.id AND nm.user_id = n.leader_id
      )
    RETURNING id, name, tag
  `;

  // 4) Empty countries still holding a leader
  const emptyLeaders = await sql`
    UPDATE nations
    SET leader_id = NULL,
        listed_price = NULL,
        listed_at = NULL
    WHERE is_default = FALSE
      AND member_count = 0
      AND leader_id IS NOT NULL
    RETURNING id, name, tag
  `;

  // 5) users.nation_id out of sync
  const userSync = await sql`
    UPDATE users u
    SET nation_id = NULL
    WHERE u.nation_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM nation_members nm
        WHERE nm.user_id = u.id AND nm.nation_id = u.nation_id
      )
    RETURNING id
  `;

  const ghostMembersRemoved = ghosts.rowCount ?? 0;
  const orphanedLeadersCleared = orphaned.rowCount ?? 0;
  const emptyLeadersCleared = emptyLeaders.rowCount ?? 0;
  const usersNationIdCleared = userSync.rowCount ?? 0;

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "heal_nations",
    targetType: "system",
    targetId: null,
    details: {
      ghostMembersRemoved,
      orphanedLeadersCleared,
      emptyLeadersCleared,
      usersNationIdCleared,
      orphaned: orphaned.rows,
      emptyLeaders: emptyLeaders.rows,
    },
    reason,
  });

  return {
    ghostMembersRemoved,
    orphanedLeadersCleared,
    emptyLeadersCleared,
    usersNationIdCleared,
    memberCountsRecalculated: true,
    // backward-compat keys for any old UI still reading these
    orphanedCleared: orphanedLeadersCleared + emptyLeadersCleared,
    multiCleared: 0,
  };
}

/** @deprecated Use adminHealNations */
export async function adminClearOrphanedLeaders(admin: AdminContext, reason: string) {
  const result = await adminHealNations(admin, reason);
  return { orphanedCleared: result.orphanedCleared };
}

/** @deprecated Use adminHealNations */
export async function adminFixMultiLeaders(admin: AdminContext, reason: string) {
  return adminHealNations(admin, reason);
}

export async function adminClearNationLeader(
  admin: AdminContext,
  nationId: number,
  reason: string,
) {
  const res = await sql`
    UPDATE nations
    SET leader_id = NULL, listed_price = NULL, listed_at = NULL
    WHERE id = ${nationId}
    RETURNING id, name, tag, leader_id
  `;
  if (!res.rowCount) throw new Error("nation_not_found");

  await recalculateReputation(nationId);

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "clear_nation_leader",
    targetType: "nation",
    targetId: nationId,
    details: { previousLeaderId: res.rows[0]?.leader_id },
    reason,
  });

  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
// Nation detail tools
// ═══════════════════════════════════════════════════════════════════

export async function adminGetNationDetails(nationId: number) {
  const res = await sql`
    SELECT n.id, n.name, n.tag, n.emblem, n.is_default, n.leader_id,
           n.total_glory, n.member_count, n.reputation,
           n.vault_wardog, n.vault_warcat, n.is_protected,
           n.protection_expires_at, n.listed_price, n.listed_at,
           n.first_claimed_at, n.original_claimer_id,
           n.join_contribution_wardog, n.join_contribution_warcat,
           n.redemption_price_wardog, n.redemption_price_warcat,
           n.active_buff, n.buff_expires_at,
           u.username AS leader_username, u.first_name AS leader_first_name,
           u.is_traitor AS leader_is_traitor
    FROM nations n
    LEFT JOIN users u ON u.id = n.leader_id
    WHERE n.id = ${nationId}
    LIMIT 1
  `;
  const n = res.rows[0];
  if (!n) return null;

  const membersRes = await sql`
    SELECT nm.user_id, nm.role, nm.weekly_glory, nm.joined_at,
           u.username, u.first_name, u.is_traitor, u.is_banned,
           COALESCE(p.glory, 0) AS glory
    FROM nation_members nm
    JOIN users u ON u.id = nm.user_id
    LEFT JOIN progress p ON p.user_id = nm.user_id
    WHERE nm.nation_id = ${nationId}
    ORDER BY
      CASE nm.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
      nm.weekly_glory DESC
    LIMIT 100
  `;

  const historyRes = await sql`
    SELECT id, event, details, created_at, user_id
    FROM nation_history
    WHERE nation_id = ${nationId}
    ORDER BY created_at DESC
    LIMIT 40
  `;

  return {
    id: Number(n.id),
    name: String(n.name),
    tag: String(n.tag),
    emblem: String(n.emblem),
    isDefault: Boolean(n.is_default),
    leaderId: n.leader_id ? Number(n.leader_id) : null,
    leaderUsername: (n.leader_username as string) ?? null,
    leaderFirstName: (n.leader_first_name as string) ?? null,
    leaderIsTraitor: Boolean(n.leader_is_traitor),
    totalGlory: Number(n.total_glory),
    memberCount: Number(n.member_count),
    reputation: Number(n.reputation ?? 0),
    vaultWardog: Number(n.vault_wardog ?? 0),
    vaultWarcat: Number(n.vault_warcat ?? 0),
    isProtected: Boolean(n.is_protected),
    protectionExpiresAt: n.protection_expires_at ? String(n.protection_expires_at) : null,
    listedPrice: n.listed_price != null ? Number(n.listed_price) : null,
    listedAt: n.listed_at ? String(n.listed_at) : null,
    firstClaimedAt: n.first_claimed_at ? String(n.first_claimed_at) : null,
    originalClaimerId: n.original_claimer_id ? Number(n.original_claimer_id) : null,
    joinContributionWardog: Number(n.join_contribution_wardog ?? 2),
    joinContributionWarcat: Number(n.join_contribution_warcat ?? 2),
    redemptionPriceWardog: Number(n.redemption_price_wardog ?? 15),
    redemptionPriceWarcat: Number(n.redemption_price_warcat ?? 15),
    activeBuff: (n.active_buff as string) ?? null,
    buffExpiresAt: n.buff_expires_at ? String(n.buff_expires_at) : null,
    members: membersRes.rows.map((m) => ({
      userId: Number(m.user_id),
      role: String(m.role) as "leader" | "officer" | "member",
      weeklyGlory: Number(m.weekly_glory),
      glory: Number(m.glory),
      joinedAt: String(m.joined_at),
      username: (m.username as string) ?? null,
      firstName: (m.first_name as string) ?? null,
      isTraitor: Boolean(m.is_traitor),
      isBanned: Boolean(m.is_banned),
    })),
    history: historyRes.rows.map((h) => ({
      id: Number(h.id),
      event: String(h.event),
      details: h.details ?? {},
      userId: h.user_id ? Number(h.user_id) : null,
      createdAt: String(h.created_at),
    })),
  };
}

export async function adminForceTransferOwnership(
  admin: AdminContext,
  nationId: number,
  toUserId: number,
  reason: string,
) {
  const nationRes = await sql`
    SELECT id, leader_id, is_default FROM nations WHERE id = ${nationId} LIMIT 1
  `;
  const nation = nationRes.rows[0];
  if (!nation) throw new Error("nation_not_found");
  if (Boolean(nation.is_default)) throw new Error("cannot_transfer_default");

  const memberRes = await sql`
    SELECT role FROM nation_members
    WHERE nation_id = ${nationId} AND user_id = ${toUserId} LIMIT 1
  `;
  if (!memberRes.rowCount) throw new Error("target_not_member");

  const oldLeaderId = nation.leader_id ? Number(nation.leader_id) : null;

  await sql`
    UPDATE nations
    SET leader_id = ${toUserId}, listed_price = NULL, listed_at = NULL
    WHERE id = ${nationId}
  `;

  if (oldLeaderId) {
    await sql`
      UPDATE nation_members SET role = 'member'
      WHERE nation_id = ${nationId} AND user_id = ${oldLeaderId}
    `;
  }
  await sql`
    UPDATE nation_members SET role = 'leader'
    WHERE nation_id = ${nationId} AND user_id = ${toUserId}
  `;

  await logNationEvent(nationId, admin.userId, "admin_transfer_ownership", {
    from: oldLeaderId,
    to: toUserId,
    adminWallet: admin.wallet,
  });
  await recalculateReputation(nationId);

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "force_transfer_ownership",
    targetType: "nation",
    targetId: nationId,
    details: { from: oldLeaderId, to: toUserId },
    reason,
  });

  return adminGetNationDetails(nationId);
}

export async function adminUpdateNationVault(
  admin: AdminContext,
  nationId: number,
  wardogDelta: number,
  warcatDelta: number,
  reason: string,
) {
  const res = await sql`
    UPDATE nations
    SET vault_wardog = GREATEST(0, vault_wardog + ${wardogDelta}),
        vault_warcat = GREATEST(0, vault_warcat + ${warcatDelta})
    WHERE id = ${nationId}
    RETURNING vault_wardog, vault_warcat
  `;
  if (!res.rowCount) throw new Error("nation_not_found");

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "update_nation_vault",
    targetType: "nation",
    targetId: nationId,
    details: {
      wardogDelta,
      warcatDelta,
      newWardog: Number(res.rows[0].vault_wardog),
      newWarcat: Number(res.rows[0].vault_warcat),
    },
    reason,
  });

  return adminGetNationDetails(nationId);
}

export async function adminSetNationProtection(
  admin: AdminContext,
  nationId: number,
  enable: boolean,
  hours: number,
  reason: string,
) {
  if (enable) {
    const expires = new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000);
    await sql`
      UPDATE nations
      SET is_protected = TRUE,
          protection_expires_at = ${expires.toISOString()}
      WHERE id = ${nationId}
    `;
  } else {
    await sql`
      UPDATE nations
      SET is_protected = FALSE,
          protection_expires_at = NULL
      WHERE id = ${nationId}
    `;
  }

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: enable ? "enable_nation_protection" : "disable_nation_protection",
    targetType: "nation",
    targetId: nationId,
    details: { enable, hours },
    reason,
  });

  return adminGetNationDetails(nationId);
}

export async function adminSetNationRedemptionPrice(
  admin: AdminContext,
  nationId: number,
  wardog: number,
  warcat: number,
  reason: string,
) {
  const w = Math.max(0, Math.min(200, wardog));
  const c = Math.max(0, Math.min(200, warcat));

  await sql`
    UPDATE nations
    SET redemption_price_wardog = ${w},
        redemption_price_warcat = ${c}
    WHERE id = ${nationId}
  `;

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "set_nation_redemption_price",
    targetType: "nation",
    targetId: nationId,
    details: { wardog: w, warcat: c },
    reason,
  });

  return adminGetNationDetails(nationId);
}

export async function adminKickNationMember(
  admin: AdminContext,
  nationId: number,
  userId: number,
  reason: string,
) {
  const memberRes = await sql`
    SELECT role FROM nation_members
    WHERE nation_id = ${nationId} AND user_id = ${userId} LIMIT 1
  `;
  if (!memberRes.rowCount) throw new Error("not_a_member");
  if (String(memberRes.rows[0].role) === "leader") {
    throw new Error("cannot_kick_leader_use_clear_or_transfer");
  }

  await sql`DELETE FROM nation_members WHERE nation_id = ${nationId} AND user_id = ${userId}`;
  await sql`UPDATE users SET nation_id = NULL WHERE id = ${userId} AND nation_id = ${nationId}`;

  await sql`
    UPDATE nations
    SET member_count = (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${nationId})
    WHERE id = ${nationId}
  `;

  await markTraitor(userId, "admin_kicked");
  await logNationEvent(nationId, admin.userId, "admin_kick", {
    kickedUserId: userId,
    adminWallet: admin.wallet,
  });
  await recalculateReputation(nationId);

  await logAdminAction({
    adminWallet: admin.wallet,
    adminUserId: admin.userId,
    action: "kick_nation_member",
    targetType: "nation",
    targetId: nationId,
    details: { kickedUserId: userId },
    reason,
  });

  return adminGetNationDetails(nationId);
}
