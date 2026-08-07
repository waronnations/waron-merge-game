/**
 * Server-only Nations history/event logging + traitor marking helpers.
 */

import { sql } from "@/lib/db.server";

export async function markTraitor(userId: number, reason: string) {
  await sql`
    UPDATE users
    SET is_traitor = TRUE,
        traitor_since = COALESCE(traitor_since, NOW()),
        traitor_reason = ${reason}
    WHERE id = ${userId}
  `;
}

export async function logNationEvent(
  nationId: number,
  userId: number | null,
  event: string,
  details: Record<string, unknown> = {},
) {
  await sql`
    INSERT INTO nation_history (nation_id, user_id, event, details)
    VALUES (${nationId}, ${userId}, ${event}, ${JSON.stringify(details)}::jsonb)
  `;
}

export interface NationHistoryRow {
  id: number;
  event: string;
  userId: number | null;
  userName: string | null;
  /** JSON-encoded event payload (kept as a string so it stays serializable). */
  details: string;
  createdAt: number;
}

/**
 * Ownership + governance history for a nation (marketplace audit trail).
 * Read-only; the future on-chain NationsRegistry emits the same events.
 */
export async function listNationHistory(
  nationId: number,
  limit = 25,
): Promise<NationHistoryRow[]> {
  const res = await sql`
    SELECT h.id, h.event, h.user_id, h.details, h.created_at,
           COALESCE(u.first_name, u.username) AS user_name
    FROM nation_history h
    LEFT JOIN users u ON u.id = h.user_id
    WHERE h.nation_id = ${nationId}
    ORDER BY h.created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 100)}
  `;
  return res.rows.map((r) => ({
    id: Number(r.id),
    event: String(r.event ?? "event"),
    userId: r.user_id === null ? null : Number(r.user_id),
    userName: (r.user_name as string | null) ?? null,
    details: JSON.stringify(r.details ?? {}),
    createdAt: new Date(r.created_at as string).getTime(),
  }));
}
