/**
 * Server-only Nations read/list queries.
 * Phase 1: protection, contribution & redemption fields.
 * Phase 2: faction (wardog | warcat | null) on claimed countries.
 *
 * listNations + getNationDetails use LIVE member counts so CLAIM
 * never depends on a stale denormalized member_count column.
 */

import { sql } from "@/lib/db.server";
import type { NationDetails, NationRankRow } from "@/lib/nations/types.server";
import { COUNTRY_NATIONS } from "@/lib/nations/types.server";
import type { NationFaction } from "@/lib/constants";

function isCurrentlyProtected(row: Record<string, unknown>): boolean {
  if (!Boolean(row.is_protected)) return false;
  if (!row.protection_expires_at) return false;
  return new Date(String(row.protection_expires_at)).getTime() > Date.now();
}

function parseFaction(value: unknown): NationFaction | null {
  if (value === "wardog" || value === "warcat") return value;
  return null;
}

export async function getMyNation(userId: number) {
  const res = await sql`
    SELECT n.id, n.name, n.tag, n.emblem, n.leader_id, n.is_default,
           n.total_glory, n.member_count, n.listed_price, n.listed_at,
           n.vault_wardog, n.vault_warcat, n.reputation, n.active_buff, n.buff_expires_at,
           n.last_nuke_received_at, n.last_nuke_launched_at,
           n.is_protected, n.protection_expires_at,
           n.join_contribution_wardog, n.join_contribution_warcat,
           n.redemption_price_wardog, n.redemption_price_warcat,
           n.faction,
           nm.role, nm.weekly_glory, nm.joined_at,
           u.is_traitor, u.traitor_since, u.traitor_reason
    FROM nation_members nm
    JOIN nations n ON n.id = nm.nation_id
    JOIN users u ON u.id = nm.user_id
    WHERE nm.user_id = ${userId}
    LIMIT 1
  `;
  const row = res.rows[0];
  if (!row) return null;

  const protectedNow = isCurrentlyProtected(row);

  const liveRes = await sql`
    SELECT COUNT(*)::int AS c FROM nation_members WHERE nation_id = ${Number(row.id)}
  `;
  const liveMemberCount = Number(liveRes.rows[0]?.c ?? 0);
  if (liveMemberCount !== Number(row.member_count)) {
    await sql`
      UPDATE nations SET member_count = ${liveMemberCount} WHERE id = ${Number(row.id)}
    `;
  }

  return {
    id: Number(row.id),
    name: String(row.name),
    tag: String(row.tag),
    emblem: String(row.emblem),
    leaderId: row.leader_id ? Number(row.leader_id) : null,
    isDefault: Boolean(row.is_default),
    totalGlory: Number(row.total_glory),
    memberCount: liveMemberCount,
    listedPrice: row.listed_price != null ? Number(row.listed_price) : null,
    listedAt: row.listed_at ? String(row.listed_at) : null,
    vaultWardog: Number(row.vault_wardog || 0),
    vaultWarcat: Number(row.vault_warcat || 0),
    reputation: Number(row.reputation || 0),
    activeBuff: row.active_buff ? String(row.active_buff) : null,
    buffExpiresAt: row.buff_expires_at ? String(row.buff_expires_at) : null,
    lastNukeReceivedAt: row.last_nuke_received_at
      ? String(row.last_nuke_received_at)
      : null,
    lastNukeLaunchedAt: row.last_nuke_launched_at
      ? String(row.last_nuke_launched_at)
      : null,
    isProtected: protectedNow,
    protectionExpiresAt: row.protection_expires_at
      ? String(row.protection_expires_at)
      : null,
    joinContributionWardog: Number(row.join_contribution_wardog ?? 2),
    joinContributionWarcat: Number(row.join_contribution_warcat ?? 2),
    redemptionPriceWardog: Number(row.redemption_price_wardog ?? 15),
    redemptionPriceWarcat: Number(row.redemption_price_warcat ?? 15),
    faction: parseFaction(row.faction),
    myRole: String(row.role) as "leader" | "officer" | "member",
    myWeeklyGlory: Number(row.weekly_glory),
    joinedAt: row.joined_at ? String(row.joined_at) : null,
    isTraitor: Boolean(row.is_traitor),
    traitorSince: row.traitor_since ? String(row.traitor_since) : null,
    traitorReason: row.traitor_reason ? String(row.traitor_reason) : null,
  };
}

export async function listNations(limit = 300) {
  const res = await sql`
    SELECT
      n.id,
      n.name,
      n.tag,
      n.emblem,
      n.leader_id,
      n.is_default,
      n.total_glory,
      (
        SELECT COUNT(*)::int
        FROM nation_members nm2
        WHERE nm2.nation_id = n.id
      ) AS live_member_count,
      n.member_count,
      n.listed_price,
      n.listed_at,
      n.vault_wardog,
      n.vault_warcat,
      n.reputation,
      n.faction,
      n.last_nuke_received_at,
      n.last_nuke_launched_at,
      n.is_protected,
      n.protection_expires_at,
      COALESCE(SUM(
        CASE
          WHEN p.state ? 'nukesOwned'
          THEN GREATEST(0, (p.state->>'nukesOwned')::numeric)
          ELSE 0
        END
      ), 0)::int AS nukes_owned_total,
      COALESCE((
        SELECT COUNT(*)::int
        FROM nation_history h
        WHERE h.nation_id = n.id
          AND h.event = 'nuked'
      ), 0) AS times_nuked
    FROM nations n
    LEFT JOIN nation_members nm ON nm.nation_id = n.id
    LEFT JOIN progress p ON p.user_id = nm.user_id
    GROUP BY
      n.id, n.name, n.tag, n.emblem, n.leader_id, n.is_default,
      n.total_glory, n.member_count, n.listed_price, n.listed_at,
      n.vault_wardog, n.vault_warcat, n.reputation, n.faction,
      n.last_nuke_received_at, n.last_nuke_launched_at,
      n.is_protected, n.protection_expires_at
    ORDER BY n.is_default DESC, n.total_glory DESC, live_member_count DESC, n.name ASC
    LIMIT ${limit}
  `;

  const rows = res.rows.map((r) => {
    const liveMemberCount = Number(r.live_member_count ?? 0);
    const storedMemberCount = Number(r.member_count ?? 0);
    let leaderId = r.leader_id ? Number(r.leader_id) : null;

    if (!Boolean(r.is_default) && liveMemberCount === 0) {
      leaderId = null;
    }

    const protectedNow = isCurrentlyProtected(r);

    return {
      id: Number(r.id),
      name: String(r.name),
      tag: String(r.tag),
      emblem: String(r.emblem),
      leaderId,
      isDefault: Boolean(r.is_default),
      totalGlory: Number(r.total_glory),
      memberCount: liveMemberCount,
      listedPrice: r.listed_price != null ? Number(r.listed_price) : null,
      listedAt: r.listed_at ? String(r.listed_at) : null,
      vaultWardog: Number(r.vault_wardog || 0),
      vaultWarcat: Number(r.vault_warcat || 0),
      reputation: Number(r.reputation || 0),
      faction: parseFaction(r.faction),
      lastNukeReceivedAt: r.last_nuke_received_at
        ? String(r.last_nuke_received_at)
        : null,
      lastNukeLaunchedAt: r.last_nuke_launched_at
        ? String(r.last_nuke_launched_at)
        : null,
      nukesOwnedTotal: Number(r.nukes_owned_total || 0),
      timesNuked: Number(r.times_nuked || 0),
      isProtected: protectedNow,
      protectionExpiresAt: r.protection_expires_at
        ? String(r.protection_expires_at)
        : null,
      _storedMemberCount: storedMemberCount,
      _needsLeaderClear:
        !Boolean(r.is_default) &&
        liveMemberCount === 0 &&
        r.leader_id != null,
    };
  });

  void (async () => {
    for (const r of rows) {
      if (r.memberCount !== r._storedMemberCount) {
        await sql`
          UPDATE nations SET member_count = ${r.memberCount} WHERE id = ${r.id}
        `.catch(() => {});
      }
      if (r._needsLeaderClear) {
        await sql`
          UPDATE nations
          SET leader_id = NULL,
              listed_price = NULL,
              listed_at = NULL,
              faction = NULL
          WHERE id = ${r.id}
            AND NOT EXISTS (
              SELECT 1 FROM nation_members WHERE nation_id = ${r.id}
            )
        `.catch(() => {});
      }
    }
  })();

  return rows.map(({ _storedMemberCount, _needsLeaderClear, ...publicRow }) => publicRow);
}

export async function getNationDetails(
  userId: number | null,
  nationId: number,
): Promise<NationDetails | null> {
  const nationRes = await sql`
    SELECT id, name, tag, emblem, leader_id, is_default, total_glory, member_count,
           listed_price, listed_at, vault_wardog, vault_warcat, reputation,
           active_buff, buff_expires_at, last_nuke_received_at, last_nuke_launched_at,
           is_protected, protection_expires_at,
           join_contribution_wardog, join_contribution_warcat,
           redemption_price_wardog, redemption_price_warcat,
           faction
    FROM nations WHERE id = ${nationId} LIMIT 1
  `;
  const n = nationRes.rows[0];
  if (!n) return null;

  const liveCountRes = await sql`
    SELECT COUNT(*)::int AS c
    FROM nation_members nm
    INNER JOIN users u ON u.id = nm.user_id
    WHERE nm.nation_id = ${nationId}
  `;
  const liveMemberCount = Number(liveCountRes.rows[0]?.c ?? 0);
  const storedMemberCount = Number(n.member_count ?? 0);

  if (liveMemberCount !== storedMemberCount) {
    await sql`
      UPDATE nations SET member_count = ${liveMemberCount} WHERE id = ${nationId}
    `;
  }

  let leaderId = n.leader_id ? Number(n.leader_id) : null;
  let faction = parseFaction(n.faction);

  if (!Boolean(n.is_default) && liveMemberCount === 0 && leaderId != null) {
    await sql`
      UPDATE nations
      SET leader_id = NULL,
          listed_price = NULL,
          listed_at = NULL,
          faction = NULL
      WHERE id = ${nationId}
    `;
    leaderId = null;
    faction = null;
  }

  if (leaderId != null && liveMemberCount > 0) {
    const leaderMemberRes = await sql`
      SELECT 1 FROM nation_members
      WHERE nation_id = ${nationId} AND user_id = ${leaderId}
      LIMIT 1
    `;
    if ((leaderMemberRes.rowCount ?? 0) === 0) {
      await sql`
        UPDATE nations
        SET leader_id = NULL,
            listed_price = NULL,
            listed_at = NULL
        WHERE id = ${nationId}
      `;
      leaderId = null;
    }
  }

  const protectedNow = isCurrentlyProtected(n);

  let leader = null;
  if (leaderId) {
    const leaderRes = await sql`
      SELECT id, username, first_name, is_traitor FROM users WHERE id = ${leaderId} LIMIT 1
    `;
    const l = leaderRes.rows[0];
    if (l) {
      leader = {
        userId: Number(l.id),
        username: (l.username as string) ?? null,
        firstName: (l.first_name as string) ?? null,
        isTraitor: Boolean(l.is_traitor),
      };
    }
  }

  const membersRes = await sql`
    SELECT nm.user_id, nm.role, nm.weekly_glory,
           u.username, u.first_name, u.is_traitor, COALESCE(p.glory, 0) AS glory
    FROM nation_members nm
    JOIN users u ON u.id = nm.user_id
    LEFT JOIN progress p ON p.user_id = nm.user_id
    WHERE nm.nation_id = ${nationId}
    ORDER BY
      CASE nm.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
      nm.weekly_glory DESC, glory DESC
    LIMIT 20
  `;

  const topMembers = membersRes.rows.map((r) => ({
    userId: Number(r.user_id),
    username: (r.username as string) ?? null,
    firstName: (r.first_name as string) ?? null,
    role: String(r.role) as "leader" | "officer" | "member",
    weeklyGlory: Number(r.weekly_glory),
    glory: Number(r.glory ?? 0),
    isTraitor: Boolean(r.is_traitor),
  }));

  let myRole: "leader" | "officer" | "member" | null = null;
  let isMember = false;
  if (userId) {
    const myRes = await sql`
      SELECT role FROM nation_members
      WHERE nation_id = ${nationId} AND user_id = ${userId} LIMIT 1
    `;
    if (myRes.rows[0]) {
      isMember = true;
      myRole = String(myRes.rows[0].role) as "leader" | "officer" | "member";
    }
  }

  const canClaim =
    !Boolean(n.is_default) &&
    liveMemberCount === 0 &&
    leaderId == null &&
    !isMember;

  const canBuy =
    !Boolean(n.is_default) &&
    n.listed_price != null &&
    Number(n.listed_price) > 0 &&
    !isMember &&
    userId !== null &&
    userId !== leaderId;

  return {
    id: Number(n.id),
    name: String(n.name),
    tag: String(n.tag),
    emblem: String(n.emblem),
    leaderId,
    isDefault: Boolean(n.is_default),
    totalGlory: Number(n.total_glory),
    memberCount: liveMemberCount,
    listedPrice: n.listed_price != null ? Number(n.listed_price) : null,
    listedAt: n.listed_at ? String(n.listed_at) : null,
    vaultWardog: Number(n.vault_wardog || 0),
    vaultWarcat: Number(n.vault_warcat || 0),
    reputation: Number(n.reputation || 0),
    activeBuff: n.active_buff ? String(n.active_buff) : null,
    buffExpiresAt: n.buff_expires_at ? String(n.buff_expires_at) : null,
    lastNukeReceivedAt: n.last_nuke_received_at
      ? String(n.last_nuke_received_at)
      : null,
    lastNukeLaunchedAt: n.last_nuke_launched_at
      ? String(n.last_nuke_launched_at)
      : null,
    isProtected: protectedNow,
    protectionExpiresAt: n.protection_expires_at
      ? String(n.protection_expires_at)
      : null,
    joinContributionWardog: Number(n.join_contribution_wardog ?? 2),
    joinContributionWarcat: Number(n.join_contribution_warcat ?? 2),
    redemptionPriceWardog: Number(n.redemption_price_wardog ?? 15),
    redemptionPriceWarcat: Number(n.redemption_price_warcat ?? 15),
    faction,
    leader,
    topMembers,
    myRole,
    isMember,
    canClaim,
    canBuy,
  };
}

export async function getNationLeaderboard(limit = 300): Promise<NationRankRow[]> {
  const res = await sql`
    SELECT n.id, n.name, n.tag, n.emblem, n.is_default, n.total_glory,
           (SELECT COUNT(*)::int FROM nation_members nm WHERE nm.nation_id = n.id) AS live_member_count,
           n.reputation, n.faction,
           u.username AS leader_username, u.first_name AS leader_first_name
    FROM nations n
    LEFT JOIN users u ON u.id = n.leader_id
    ORDER BY n.total_glory DESC, live_member_count DESC, n.name ASC
    LIMIT ${limit}
  `;
  return res.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    tag: String(r.tag),
    emblem: String(r.emblem),
    isDefault: Boolean(r.is_default),
    totalGlory: Number(r.total_glory),
    memberCount: Number(r.live_member_count ?? 0),
    reputation: Number(r.reputation || 0),
    faction: parseFaction(r.faction),
    leaderName: r.leader_username
      ? `@${r.leader_username}`
      : ((r.leader_first_name as string | null) ?? null),
  }));
}

export async function getNationMembers(nationId: number, limit = 50) {
  const res = await sql`
    SELECT nm.user_id, nm.role, nm.weekly_glory,
           u.username, u.first_name, u.is_traitor, COALESCE(p.glory, 0) AS glory
    FROM nation_members nm
    JOIN users u ON u.id = nm.user_id
    LEFT JOIN progress p ON p.user_id = nm.user_id
    WHERE nm.nation_id = ${nationId}
    ORDER BY
      CASE nm.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
      nm.weekly_glory DESC, glory DESC
    LIMIT ${limit}
  `;
  return res.rows.map((r) => ({
    userId: Number(r.user_id),
    username: (r.username as string) ?? null,
    firstName: (r.first_name as string) ?? null,
    role: String(r.role) as "leader" | "officer" | "member",
    weeklyGlory: Number(r.weekly_glory),
    glory: Number(r.glory ?? 0),
    isTraitor: Boolean(r.is_traitor),
  }));
}

export async function seedCountryNations() {
  for (const c of COUNTRY_NATIONS) {
    await sql`
      INSERT INTO nations (name, tag, emblem, is_default)
      SELECT ${c.name}, ${c.tag}, ${c.emblem}, FALSE
      WHERE NOT EXISTS (SELECT 1 FROM nations WHERE tag = ${c.tag})
    `;
  }
  await sql`
    INSERT INTO nations (name, tag, emblem, is_default, faction)
    SELECT 'WARDOG Nation', 'DOG', 'dog', TRUE, 'wardog'
    WHERE NOT EXISTS (SELECT 1 FROM nations WHERE tag = 'DOG')
  `;
  await sql`
    INSERT INTO nations (name, tag, emblem, is_default, faction)
    SELECT 'WARCAT Nation', 'CAT', 'cat', TRUE, 'warcat'
    WHERE NOT EXISTS (SELECT 1 FROM nations WHERE tag = 'CAT')
  `;
  await sql`UPDATE nations SET faction = 'wardog' WHERE tag = 'DOG' AND faction IS DISTINCT FROM 'wardog'`;
  await sql`UPDATE nations SET faction = 'warcat' WHERE tag = 'CAT' AND faction IS DISTINCT FROM 'warcat'`;
}

/** Recent strategic strikes for the global short pop-up. */
export async function getRecentStrikes(limit = 8) {
  const res = await sql`
    SELECT
      h.id,
      h.nation_id AS target_id,
      h.user_id AS attacker_id,
      h.created_at,
      h.details,
      tn.name AS target_name,
      tn.tag AS target_tag,
      tn.emblem AS target_emblem,
      u.username AS attacker_username,
      u.first_name AS attacker_first_name,
      an.name AS attacker_nation_name
    FROM nation_history h
    JOIN nations tn ON tn.id = h.nation_id
    LEFT JOIN users u ON u.id = h.user_id
    LEFT JOIN nation_members nm ON nm.user_id = h.user_id
    LEFT JOIN nations an ON an.id = nm.nation_id
    WHERE h.event = 'nuked'
    ORDER BY h.created_at DESC
    LIMIT ${limit}
  `;

  return res.rows.map((r) => ({
    id: Number(r.id),
    targetId: Number(r.target_id),
    targetName: String(r.target_name),
    targetTag: String(r.target_tag),
    targetEmblem: String(r.target_emblem || "sword"),
    attackerId: r.attacker_id ? Number(r.attacker_id) : null,
    attackerName: r.attacker_username
      ? `@${r.attacker_username}`
      : (r.attacker_first_name as string | null) ?? "Unknown",
    attackerNationName: r.attacker_nation_name
      ? String(r.attacker_nation_name)
      : null,
    createdAt: r.created_at ? String(r.created_at) : null,
  }));
}
