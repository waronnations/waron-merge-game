/**
 * Server-only Nations membership: join/leave, officers, glory, requireUserId.
 * Phase 1: protected-nation contribution acceptance on join.
 * Phase 2: random WARDOG/WARCAT faction assigned on country claim.
 *
 * ONE NATION RULE:
 * - A player may belong to at most one nation at a time.
 * - To claim another empty country or join another, they must leave first.
 * - To take leadership of an owned country, they buy it (seller listed it) —
 *   and must not already be in a different nation.
 * - Leaving as leader clears leader_id and marks traitor.
 * - Faction on a country is set on first claim; cleared when nation empties.
 */

import { sql } from "@/lib/db.server";
import { readSession } from "@/lib/session.server";
import {
  TRAITOR_CANNOT_CLAIM_EMPTY,
  NATION_LEADER_MIN_TENURE_HOURS,
  MAX_OFFICERS,
  DEFAULT_PROTECTED_JOIN_CONTRIBUTION,
  WEEKLY_GLORY_ROLE_MULT,
  NATION_BUFFS,
  randomNationFaction,
  type NationFaction,
} from "@/lib/constants";
import { getMyNation } from "@/lib/nations/list.server";
import { logNationEvent, markTraitor } from "@/lib/nations/history.server";
import { recalculateReputation } from "@/lib/nations/reputation.server";
import { loadProgress, writeProgress } from "@/lib/game.server";
import { subTokens } from "@/lib/tokens";

export async function requireUserId(): Promise<number> {
  const session = await readSession();
  const userId = session.data?.userId;
  if (!userId) throw new Error("unauthorized");
  return userId;
}

/**
 * Add weekly glory for a player, applying:
 * - Nation gloryBoost / other gloryMult buffs (if active)
 * - Role multiplier (leader / officer / member)
 * Then update nation total_glory and occasionally recalc reputation.
 */
export async function addWeeklyGlory(userId: number, amount: number) {
  if (amount <= 0) return;

  let finalAmount = amount;

  const infoRes = await sql`
    SELECT nm.role, n.active_buff, n.buff_expires_at, n.id AS nation_id
    FROM nation_members nm
    JOIN nations n ON n.id = nm.nation_id
    WHERE nm.user_id = ${userId}
    LIMIT 1
  `;
  const info = infoRes.rows[0];
  if (!info) return;

  const role = String(info.role) as keyof typeof WEEKLY_GLORY_ROLE_MULT;
  const roleMult = WEEKLY_GLORY_ROLE_MULT[role] ?? 1;

  let buffMult = 1;
  if (info.active_buff && info.buff_expires_at) {
    const expires = new Date(String(info.buff_expires_at)).getTime();
    if (Date.now() < expires) {
      const buffDef = NATION_BUFFS[info.active_buff as keyof typeof NATION_BUFFS];
      if (buffDef && "gloryMult" in buffDef) {
        buffMult = Number(buffDef.gloryMult) || 1;
      }
    }
  }

  finalAmount = Math.floor(amount * roleMult * buffMult);

  await sql`
    UPDATE nation_members
    SET weekly_glory = weekly_glory + ${finalAmount}
    WHERE user_id = ${userId}
  `;

  await sql`
    UPDATE nations
    SET total_glory = total_glory + ${finalAmount}
    WHERE id = ${Number(info.nation_id)}
  `;

  if (Math.random() < 0.15) {
    await recalculateReputation(Number(info.nation_id));
  }
}

/**
 * Clear orphaned leaderships: nations where this user is still leader_id
 * but is no longer a member. Does NOT touch nations they are still a member of.
 * Also clears faction when the nation has zero members (next claim re-rolls).
 */
async function clearOrphanedLeaderships(userId: number) {
  const orphaned = await sql`
    UPDATE nations n
    SET leader_id = NULL,
        listed_price = NULL,
        listed_at = NULL
    WHERE n.leader_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM nation_members nm
        WHERE nm.nation_id = n.id AND nm.user_id = ${userId}
      )
    RETURNING id
  `;

  for (const row of orphaned.rows) {
    const nid = Number(row.id);
    await logNationEvent(nid, userId, "orphaned_leader_cleared", {
      reason: "user_no_longer_member",
    });
    await sql`
      UPDATE nations
      SET member_count = (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${nid}),
          faction = CASE
            WHEN (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${nid}) = 0
              AND is_default = FALSE
            THEN NULL
            ELSE faction
          END
      WHERE id = ${nid}
    `;
    await recalculateReputation(nid);
  }

  return orphaned.rowCount ?? 0;
}

/**
 * Fully detach a user from a specific nation.
 */
export async function removeUserFromNation(
  userId: number,
  nationId: number,
  reason: string,
) {
  const memberRes = await sql`
    SELECT role FROM nation_members
    WHERE nation_id = ${nationId} AND user_id = ${userId}
    LIMIT 1
  `;
  const wasMember = (memberRes.rowCount ?? 0) > 0;
  const wasLeaderRole =
    wasMember && String(memberRes.rows[0]?.role) === "leader";

  const ledRes = await sql`
    SELECT id FROM nations
    WHERE id = ${nationId} AND leader_id = ${userId}
    LIMIT 1
  `;
  const wasLeaderId = (ledRes.rowCount ?? 0) > 0;

  if (!wasMember && !wasLeaderId) {
    return { ok: true as const, changed: false };
  }

  if (wasMember) {
    await sql`
      DELETE FROM nation_members
      WHERE nation_id = ${nationId} AND user_id = ${userId}
    `;
  }

  await sql`
    UPDATE users
    SET nation_id = NULL
    WHERE id = ${userId} AND nation_id = ${nationId}
  `;

  if (wasLeaderId) {
    await sql`
      UPDATE nations
      SET leader_id = NULL,
          listed_price = NULL,
          listed_at = NULL
      WHERE id = ${nationId} AND leader_id = ${userId}
    `;
  }

  await sql`
    UPDATE nations
    SET member_count = (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${nationId}),
        faction = CASE
          WHEN (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${nationId}) = 0
            AND is_default = FALSE
          THEN NULL
          ELSE faction
        END
    WHERE id = ${nationId}
  `;

  if (wasLeaderId || wasLeaderRole) {
    await markTraitor(userId, reason || "removed_as_leader");
  }

  await logNationEvent(nationId, userId, "force_remove", {
    reason,
    wasMember,
    wasLeaderId,
  });
  await recalculateReputation(nationId);

  return { ok: true as const, changed: true, wasLeaderId, wasMember };
}

/**
 * Join a nation (or claim an empty non-default country).
 * On claim: assign random WARDOG/WARCAT faction if not already set.
 */
export async function joinNation(
  userId: number,
  nationId: number,
  acceptContribution = false,
) {
  await clearOrphanedLeaderships(userId);

  const current = await getMyNation(userId);
  if (current && current.id !== nationId) {
    throw new Error("must_leave_current_nation");
  }

  const otherLead = await sql`
    SELECT id FROM nations
    WHERE leader_id = ${userId} AND id != ${nationId}
    LIMIT 1
  `;
  if ((otherLead.rowCount ?? 0) > 0) {
    throw new Error("must_leave_or_sell_current_nation");
  }

  if (current && current.id === nationId) {
    return current;
  }

  const nationRes = await sql`
    SELECT id, is_default, leader_id, member_count, faction,
           is_protected, protection_expires_at,
           join_contribution_wardog, join_contribution_warcat
    FROM nations WHERE id = ${nationId} LIMIT 1
  `;
  const nation = nationRes.rows[0];
  if (!nation) throw new Error("nation_not_found");

  const isDefault = Boolean(nation.is_default);

  const liveCountRes = await sql`
    SELECT COUNT(*)::int AS c FROM nation_members WHERE nation_id = ${nationId}
  `;
  const liveMemberCount = Number(liveCountRes.rows[0]?.c ?? 0);

  if (liveMemberCount !== Number(nation.member_count)) {
    await sql`
      UPDATE nations SET member_count = ${liveMemberCount} WHERE id = ${nationId}
    `;
  }

  let leaderId = nation.leader_id ? Number(nation.leader_id) : null;
  if (!isDefault && liveMemberCount === 0 && leaderId != null) {
    await sql`
      UPDATE nations
      SET leader_id = NULL, listed_price = NULL, listed_at = NULL, faction = NULL
      WHERE id = ${nationId}
    `;
    leaderId = null;
  }

  const isEmpty = liveMemberCount === 0 && leaderId == null;

  const protectedUntil = nation.protection_expires_at
    ? new Date(String(nation.protection_expires_at)).getTime()
    : 0;
  const isCurrentlyProtected =
    Boolean(nation.is_protected) && protectedUntil > Date.now();

  if (isCurrentlyProtected && !acceptContribution) {
    throw new Error("contribution_required");
  }

  if (TRAITOR_CANNOT_CLAIM_EMPTY && isEmpty && !isDefault) {
    const traitorRes = await sql`SELECT is_traitor FROM users WHERE id = ${userId}`;
    if (Boolean(traitorRes.rows[0]?.is_traitor)) {
      throw new Error("traitors_cannot_claim_empty");
    }
  }

  let contribW = 0;
  let contribC = 0;

  if (isCurrentlyProtected) {
    contribW = Number(
      nation.join_contribution_wardog ?? DEFAULT_PROTECTED_JOIN_CONTRIBUTION.wardog,
    );
    contribC = Number(
      nation.join_contribution_warcat ?? DEFAULT_PROTECTED_JOIN_CONTRIBUTION.warcat,
    );

    if (contribW > 0 || contribC > 0) {
      const prog = await loadProgress(userId);
      if (!prog) throw new Error("no_progress");

      if (Number(prog.wardog_tokens) < contribW - 1e-6) {
        throw new Error("insufficient_tokens_for_contribution");
      }
      if (Number(prog.warcat_tokens) < contribC - 1e-6) {
        throw new Error("insufficient_tokens_for_contribution");
      }

      const newState = {
        ...(prog.state as any),
        wardogTokens: subTokens(prog.wardog_tokens, contribW),
        warcatTokens: subTokens(prog.warcat_tokens, contribC),
      };
      await writeProgress(userId, newState, { touchSyncClock: false });

      await sql`
        UPDATE nations
        SET vault_wardog = vault_wardog + ${contribW},
            vault_warcat = vault_warcat + ${contribC}
        WHERE id = ${nationId}
      `;
    }
  }

  let role: "leader" | "member" = "member";
  let assignedFaction: NationFaction | null = null;

  // Claim empty non-default country → leader + random faction
  if (!isDefault && isEmpty) {
    assignedFaction = randomNationFaction();

    const claim = await sql`
      UPDATE nations
      SET leader_id = ${userId},
          member_count = 1,
          first_claimed_at = COALESCE(first_claimed_at, NOW()),
          original_claimer_id = COALESCE(original_claimer_id, ${userId}),
          faction = COALESCE(faction, ${assignedFaction})
      WHERE id = ${nationId}
        AND leader_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM nation_members WHERE nation_id = ${nationId}
        )
      RETURNING id, faction
    `;
    if (claim.rowCount && claim.rowCount > 0) {
      role = "leader";
      const f = claim.rows[0]?.faction;
      assignedFaction =
        f === "wardog" || f === "warcat" ? f : assignedFaction;
    } else {
      const again = await sql`
        SELECT leader_id, member_count, is_default, faction
        FROM nations WHERE id = ${nationId}
      `;
      const n2 = again.rows[0];
      if (!n2 || Boolean(n2.is_default)) throw new Error("nation_not_found");
      if (n2.leader_id == null && Number(n2.member_count) === 0) {
        throw new Error("claim_failed");
      }
      role = "member";
      const f = n2.faction;
      assignedFaction = f === "wardog" || f === "warcat" ? f : null;
    }
  }

  await sql`
    INSERT INTO nation_members (nation_id, user_id, role)
    VALUES (${nationId}, ${userId}, ${role})
    ON CONFLICT (nation_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `;

  await sql`
    UPDATE nations
    SET member_count = (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${nationId})
    WHERE id = ${nationId}
  `;

  await sql`UPDATE users SET nation_id = ${nationId} WHERE id = ${userId}`;

  await logNationEvent(nationId, userId, role === "leader" ? "claim" : "join", {
    acceptedContribution: isCurrentlyProtected,
    contributionWardog: contribW,
    contributionWarcat: contribC,
    faction: assignedFaction,
  });
  await recalculateReputation(nationId);

  return getMyNation(userId);
}

export async function leaveNation(userId: number) {
  const my = await getMyNation(userId);
  if (!my) {
    await clearOrphanedLeaderships(userId);
    return null;
  }

  if (my.myRole === "leader" && my.joinedAt) {
    const joined = new Date(my.joinedAt).getTime();
    const hours = (Date.now() - joined) / (1000 * 60 * 60);
    if (hours < NATION_LEADER_MIN_TENURE_HOURS) {
      throw new Error("leader_min_tenure");
    }
  }

  await sql`DELETE FROM nation_members WHERE user_id = ${userId}`;
  await sql`UPDATE users SET nation_id = NULL WHERE id = ${userId}`;

  if (my.myRole === "leader") {
    await sql`
      UPDATE nations
      SET leader_id = NULL,
          listed_price = NULL,
          listed_at = NULL
      WHERE id = ${my.id} AND leader_id = ${userId}
    `;
    await markTraitor(userId, "left_as_leader");
  } else {
    await markTraitor(userId, "left_nation");
  }

  await clearOrphanedLeaderships(userId);

  await sql`
    UPDATE nations
    SET member_count = (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${my.id}),
        faction = CASE
          WHEN (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${my.id}) = 0
            AND is_default = FALSE
          THEN NULL
          ELSE faction
        END
    WHERE id = ${my.id}
  `;

  await logNationEvent(my.id, userId, "leave");
  await recalculateReputation(my.id);

  return null;
}

export async function promoteOfficer(leaderId: number, toUserId: number) {
  if (leaderId === toUserId) throw new Error("cannot_promote_self");

  const my = await getMyNation(leaderId);
  if (!my || my.myRole !== "leader") throw new Error("not_leader");

  const countRes = await sql`
    SELECT COUNT(*)::int AS c FROM nation_members
    WHERE nation_id = ${my.id} AND role = 'officer'
  `;
  if (Number(countRes.rows[0]?.c || 0) >= MAX_OFFICERS) {
    throw new Error("max_officers_reached");
  }

  const targetRes = await sql`
    SELECT role FROM nation_members
    WHERE nation_id = ${my.id} AND user_id = ${toUserId} LIMIT 1
  `;
  if (targetRes.rowCount === 0) throw new Error("target_not_member");
  if (String(targetRes.rows[0].role) !== "member") throw new Error("already_officer");

  await sql`
    UPDATE nation_members SET role = 'officer'
    WHERE nation_id = ${my.id} AND user_id = ${toUserId}
  `;

  await logNationEvent(my.id, leaderId, "promote_officer", { toUserId });
  return getMyNation(leaderId);
}

export async function demoteOfficer(leaderId: number, toUserId: number) {
  if (leaderId === toUserId) throw new Error("cannot_demote_self");

  const my = await getMyNation(leaderId);
  if (!my || my.myRole !== "leader") throw new Error("not_leader");

  const targetRes = await sql`
    SELECT role FROM nation_members
    WHERE nation_id = ${my.id} AND user_id = ${toUserId} LIMIT 1
  `;
  if (targetRes.rowCount === 0) throw new Error("target_not_member");
  if (String(targetRes.rows[0].role) !== "officer") throw new Error("not_officer");

  await sql`
    UPDATE nation_members SET role = 'member'
    WHERE nation_id = ${my.id} AND user_id = ${toUserId}
  `;

  await logNationEvent(my.id, leaderId, "demote_officer", { toUserId });
  return getMyNation(leaderId);
}

export async function kickMember(leaderId: number, toUserId: number) {
  if (leaderId === toUserId) throw new Error("cannot_kick_self");

  const my = await getMyNation(leaderId);
  if (!my || my.myRole !== "leader") throw new Error("not_leader");

  const targetRes = await sql`
    SELECT role FROM nation_members
    WHERE nation_id = ${my.id} AND user_id = ${toUserId} LIMIT 1
  `;
  if (targetRes.rowCount === 0) throw new Error("target_not_member");

  const targetRole = String(targetRes.rows[0].role);
  if (targetRole === "leader") throw new Error("cannot_kick_leader");
  if (targetRole === "officer") throw new Error("cannot_kick_officer");

  await sql`DELETE FROM nation_members WHERE nation_id = ${my.id} AND user_id = ${toUserId}`;
  await sql`UPDATE users SET nation_id = NULL WHERE id = ${toUserId} AND nation_id = ${my.id}`;

  await sql`
    UPDATE nations
    SET member_count = (SELECT COUNT(*) FROM nation_members WHERE nation_id = ${my.id})
    WHERE id = ${my.id}
  `;

  await markTraitor(toUserId, "kicked");

  await logNationEvent(my.id, leaderId, "kick_member", { toUserId });
  await recalculateReputation(my.id);

  return getMyNation(leaderId);
}
