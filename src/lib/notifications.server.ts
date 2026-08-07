/**
 * Server-only notification scheduling + delivery.
 *
 * The Vercel Hobby plan has no cron, so due notifications are flushed
 * opportunistically on every authenticated request that calls
 * `flushDueNotifications()` (login, schedule). The `/api/public/telegram/tick`
 * route remains available for an external scheduler but is not required.
 */

import { z } from "zod";
import { sql } from "@/lib/db.server";
import { sendBotMessage } from "@/lib/notify.server";
import { readSession } from "@/lib/session.server";

export const KindSchema = z.enum(["energy_full", "daily_ready"]);
export type Kind = z.infer<typeof KindSchema>;

export const ScheduleInput = z.object({
  kind: KindSchema,
  dueAt: z.number().int().min(0),
});

export const TEXTS: Record<Kind, string> = {
  energy_full: "⚡ Your War On Nations energy is fully recharged. Time to merge, Commander.",
  daily_ready: "🎖 Your daily bonus is ready in War On Nations. Claim your streak reward!",
};

export async function sessionIds(): Promise<{ userId: number; telegramId: number } | null> {
  const session = await readSession();
  const { userId, telegramId } = session.data ?? {};
  if (!userId || !telegramId) return null;
  return { userId, telegramId };
}

export async function scheduleFor(
  userId: number,
  telegramId: number,
  kind: Kind,
  dueAt: number,
): Promise<{ ok: true; scheduled: boolean; dueAt?: number }> {
  await sql`
    DELETE FROM notifications
     WHERE user_id = ${userId} AND kind = ${kind} AND sent = FALSE
  `;
  if (dueAt <= Date.now()) return { ok: true, scheduled: false };
  await sql`
    INSERT INTO notifications (user_id, telegram_id, kind, text, due_at)
    VALUES (${userId}, ${telegramId}, ${kind}, ${TEXTS[kind]}, ${new Date(dueAt).toISOString()})
  `;
  return { ok: true, scheduled: true, dueAt };
}

export async function cancelFor(userId: number): Promise<void> {
  await sql`DELETE FROM notifications WHERE user_id = ${userId} AND sent = FALSE`;
}

/**
 * Claim-and-send up to `limit` due notifications. Rows are marked sent in a
 * single atomic UPDATE first, so concurrent requests never double-send.
 * Never throws — delivery problems are reported in the result.
 */
export async function flushDueNotifications(limit = 25) {
  const rows = await sql`
    UPDATE notifications
       SET sent = TRUE, sent_at = NOW()
     WHERE id IN (
       SELECT id FROM notifications
        WHERE sent = FALSE AND due_at <= NOW()
        ORDER BY due_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
     )
     RETURNING id, telegram_id, text
  `;
  const results: { id: number; ok: boolean; status: number; error?: string }[] = [];
  for (const r of rows.rows) {
    const res = await sendBotMessage(Number(r.telegram_id), String(r.text));
    results.push({ id: Number(r.id), ok: res.ok, status: res.status, error: res.error });
  }
  return results;
}
