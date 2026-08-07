/**
 * Server-only Seasonal Ranked + permanent badges
 */
import { sql } from "@/lib/db.server";
import { readSession } from "@/lib/session.server";

export async function requireUserId(): Promise<number> {
  const session = await readSession();
  const userId = session.data?.userId;
  if (!userId) throw new Error("unauthorized");
  return userId;
}

export async function getActiveSeason() {
  const res = await sql`
    SELECT id, name, starts_at, ends_at
    FROM seasons
    WHERE is_active = TRUE
    ORDER BY starts_at DESC
    LIMIT 1
  `;
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    name: String(row.name),
    startsAt: new Date(row.starts_at as string).getTime(),
    endsAt: new Date(row.ends_at as string).getTime(),
  };
}

export async function ensureCurrentSeason() {
  const now = new Date();
  const active = await getActiveSeason();
  if (active && active.endsAt > now.getTime()) return active;

  // Close previous
  await sql`UPDATE seasons SET is_active = FALSE WHERE is_active = TRUE`;

  // Create new monthly season
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  const name = `Season ${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;

  const ins = await sql`
    INSERT INTO seasons (name, starts_at, ends_at, is_active)
    VALUES (${name}, ${start.toISOString()}, ${end.toISOString()}, TRUE)
    RETURNING id, name, starts_at, ends_at
  `;
  const row = ins.rows[0];
  return {
    id: Number(row.id),
    name: String(row.name),
    startsAt: new Date(row.starts_at as string).getTime(),
    endsAt: new Date(row.ends_at as string).getTime(),
  };
}

export async function addSeasonalGlory(userId: number, gloryDelta: number) {
  if (gloryDelta <= 0) return;
  const season = await ensureCurrentSeason();
  await sql`
    INSERT INTO seasonal_scores (season_id, user_id, glory, highest_tier)
    VALUES (${season.id}, ${userId}, ${gloryDelta}, 1)
    ON CONFLICT (season_id, user_id)
    DO UPDATE SET glory = seasonal_scores.glory + ${gloryDelta}
  `;
}

export async function getSeasonalLeaderboard(limit = 100) {
  const season = await ensureCurrentSeason();
  const res = await sql`
    SELECT s.user_id, s.glory, s.highest_tier,
           u.username, u.first_name
    FROM seasonal_scores s
    JOIN users u ON u.id = s.user_id
    WHERE s.season_id = ${season.id}
    ORDER BY s.glory DESC, s.highest_tier DESC
    LIMIT ${limit}
  `;
  return {
    season,
    entries: res.rows.map((r, i) => ({
      rank: i + 1,
      userId: Number(r.user_id),
      username: (r.username as string) ?? null,
      firstName: (r.first_name as string) ?? null,
      glory: Number(r.glory),
      highestTier: Number(r.highest_tier),
    })),
  };
}

export async function awardSeasonBadges(seasonId: number) {
  // Top 1 → permanent Champion badge
  const top = await sql`
    SELECT user_id FROM seasonal_scores
    WHERE season_id = ${seasonId}
    ORDER BY glory DESC LIMIT 1
  `;
  if (top.rows[0]) {
    await sql`
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (${Number(top.rows[0].user_id)}, ${`season_${seasonId}_champion`})
      ON CONFLICT DO NOTHING
    `;
  }
  // Top 10 → Elite badge
  const top10 = await sql`
    SELECT user_id FROM seasonal_scores
    WHERE season_id = ${seasonId}
    ORDER BY glory DESC LIMIT 10
  `;
  for (const row of top10.rows) {
    await sql`
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (${Number(row.user_id)}, ${`season_${seasonId}_elite`})
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function getUserBadges(userId: number) {
  const res = await sql`
    SELECT badge_id, earned_at FROM user_badges
    WHERE user_id = ${userId}
    ORDER BY earned_at DESC
  `;
  return res.rows.map((r) => ({
    id: String(r.badge_id),
    earnedAt: new Date(r.earned_at as string).getTime(),
  }));
}
