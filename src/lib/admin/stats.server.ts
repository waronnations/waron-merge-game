// src/lib/admin/stats.server.ts
/**
 * Admin dashboard aggregate stats.
 * Server-only. Re-exported from @/lib/admin.server.
 */

import { sql } from "@/lib/db.server";

// ─── Dashboard stats ───────────────────────────────────────────────

export async function getAdminDashboardStats() {
  const [
    usersRes,
    activeRes,
    nationsRes,
    claimedRes,
    tokensRes,
    traitorsRes,
    recentJoinsRes,
    pendingClaimsRes,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS c FROM users`,
    sql`SELECT COUNT(*)::int AS c FROM users WHERE last_login_at > NOW() - INTERVAL '24 hours'`,
    sql`SELECT COUNT(*)::int AS c FROM nations WHERE is_default = FALSE`,
    sql`SELECT COUNT(*)::int AS c FROM nations WHERE is_default = FALSE AND leader_id IS NOT NULL`,
    sql`
      SELECT
        COALESCE(SUM(wardog_tokens), 0)::float AS wardog,
        COALESCE(SUM(warcat_tokens), 0)::float AS warcat
      FROM progress
    `,
    sql`SELECT COUNT(*)::int AS c FROM users WHERE is_traitor = TRUE`,
    sql`
      SELECT nh.event, nh.created_at, n.name, n.tag, n.emblem
      FROM nation_history nh
      JOIN nations n ON n.id = nh.nation_id
      WHERE nh.event IN ('claim', 'join', 'leave')
      ORDER BY nh.created_at DESC
      LIMIT 15
    `,
    sql`SELECT COUNT(*)::int AS c FROM claims WHERE status = 'pending'`,
  ]);

  const multiLeaderRes = await sql`
    SELECT
      u.id AS user_id,
      u.username,
      u.first_name,
      u.wallet_address,
      COUNT(n.id)::int AS leader_count,
      COALESCE(
        json_agg(
          json_build_object(
            'nationId', n.id,
            'name', n.name,
            'tag', n.tag,
            'emblem', n.emblem,
            'memberCount', n.member_count
          )
          ORDER BY n.member_count DESC, n.id ASC
        ),
        '[]'::json
      ) AS nations
    FROM nations n
    JOIN users u ON u.id = n.leader_id
    WHERE n.leader_id IS NOT NULL
    GROUP BY u.id, u.username, u.first_name, u.wallet_address
    HAVING COUNT(n.id) > 1
    ORDER BY leader_count DESC
    LIMIT 50
  `;

  return {
    totalUsers: Number(usersRes.rows[0]?.c ?? 0),
    activeLast24h: Number(activeRes.rows[0]?.c ?? 0),
    totalCountries: Number(nationsRes.rows[0]?.c ?? 0),
    claimedCountries: Number(claimedRes.rows[0]?.c ?? 0),
    totalWardog: Number(tokensRes.rows[0]?.wardog ?? 0),
    totalWarcat: Number(tokensRes.rows[0]?.warcat ?? 0),
    traitorCount: Number(traitorsRes.rows[0]?.c ?? 0),
    pendingClaims: Number(pendingClaimsRes.rows[0]?.c ?? 0),
    multiLeaders: multiLeaderRes.rows.map((r) => {
      const nations = (Array.isArray(r.nations) ? r.nations : []) as Array<{
        nationId: number;
        name: string;
        tag: string;
        emblem: string;
        memberCount: number;
      }>;
      return {
        userId: Number(r.user_id),
        username: (r.username as string) ?? null,
        firstName: (r.first_name as string) ?? null,
        wallet: (r.wallet_address as string) ?? null,
        leaderCount: Number(r.leader_count),
        tags: nations.map((n) => n.tag),
        nations,
      };
    }),
    recentActivity: recentJoinsRes.rows.map((r) => ({
      event: String(r.event ?? "event"),
      at: String(r.created_at),
      nationName: String(r.name),
      nationTag: String(r.tag),
      emblem: String(r.emblem),
    })),
  };
}
