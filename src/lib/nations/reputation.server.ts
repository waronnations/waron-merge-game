// src/lib/nations/reputation.server.ts
/**
 * Server-only Nations reputation recalculation.
 * Supports optional additive bonuses from donations, buffs, protection, invites.
 */

import { sql } from "@/lib/db.server";

/**
 * Recalculate base reputation from glory / members / traitors,
 * then optionally add a one-time bonus (e.g. from vault donation or buff activation).
 */
export async function recalculateReputation(
  nationId: number,
  bonus = 0,
) {
  const res = await sql`
    SELECT total_glory, member_count,
           (SELECT COUNT(*) FROM users u
            JOIN nation_members nm ON nm.user_id = u.id
            WHERE nm.nation_id = ${nationId} AND u.is_traitor = TRUE) AS traitor_count
    FROM nations WHERE id = ${nationId}
  `;
  const row = res.rows[0];
  if (!row) return;

  const glory = Number(row.total_glory || 0);
  const members = Number(row.member_count || 0);
  const traitors = Number(row.traitor_count || 0);

  // Base formula (kept compatible with existing values)
  let score = Math.max(
    0,
    Math.floor(glory / 800) + members * 8 - traitors * 25,
  );

  // Additive social/competitive bonus
  if (bonus && Number.isFinite(bonus)) {
    score = Math.max(0, score + Math.floor(bonus));
  }

  await sql`UPDATE nations SET reputation = ${score} WHERE id = ${nationId}`;
}
