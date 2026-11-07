import { sql, hasDatabase } from "@/lib/db/client.server";
import { sendBotMessage } from "@/lib/notify.server";
import { ensureWarSchema, getSeason } from "./season.server";
import { MEMEWAR_ALERT_COOLDOWN_MS } from "@/lib/constants/memewar";

export async function flushWarAlerts() {
  if (!hasDatabase()) return { sent: 0 };
  await ensureWarSchema();
  const season = await getSeason();
  const { rows } = await sql`SELECT p.user_id, p.champion, p.last_rank, p.last_alert_at, u.telegram_id FROM memewar_preferences p JOIN users u ON u.id = p.user_id WHERE p.alerts = TRUE AND p.champion IS NOT NULL LIMIT 100`;
  for (const r of rows) {
    const index = season.ranking.findIndex(c => c.master === r.champion);
    if (index < 0) continue;
    const rank = index + 1;
    const previous = r.last_rank === null ? null : Number(r.last_rank);
    const due = !r.last_alert_at || Date.now() - new Date(String(r.last_alert_at)).getTime() >= MEMEWAR_ALERT_COOLDOWN_MS;
    if (previous !== null && rank > previous && due) {
      const coin = season.ranking[index];
      if (coin) {
        const symbol = coin.symbol.replace(/[<>&]/g, "");
        const text = `${symbol} dropped to #${rank} this season. Rally your army: https://t.me/waronnationsgamebot\nTurn off rank alerts in Profile.`;
        await sql`INSERT INTO memewar_alerts (user_id, telegram_id, text, dedup_key) VALUES (${Number(r.user_id)}, ${Number(r.telegram_id)}, ${text}, ${`${season.id}:${r.user_id}:${previous}:${rank}:${Math.floor(Date.now() / MEMEWAR_ALERT_COOLDOWN_MS)}`}) ON CONFLICT DO NOTHING`;
        await sql`UPDATE memewar_preferences SET last_alert_at = now() WHERE user_id = ${Number(r.user_id)}`;
      }
    }
    await sql`UPDATE memewar_preferences SET last_rank = ${rank} WHERE user_id = ${Number(r.user_id)}`;
  }
  const queue = await sql`UPDATE memewar_alerts SET locked_until = now() + interval '2 minutes', attempts = attempts + 1 WHERE id IN (SELECT a.id FROM memewar_alerts a JOIN memewar_preferences p ON p.user_id = a.user_id WHERE p.alerts = TRUE AND a.sent_at IS NULL AND a.retry_at <= now() AND (a.locked_until IS NULL OR a.locked_until < now()) AND a.attempts < 5 ORDER BY a.id LIMIT 10 FOR UPDATE OF a SKIP LOCKED) RETURNING id, telegram_id, text`;
  let sent = 0;
  for (const row of queue.rows) {
    const result = await sendBotMessage(Number(row.telegram_id), String(row.text));
    if (result.ok) {
      await sql`UPDATE memewar_alerts SET sent_at = now(), locked_until = NULL WHERE id = ${Number(row.id)}`;
      sent++;
    } else await sql`UPDATE memewar_alerts SET retry_at = now() + interval '15 minutes', locked_until = NULL WHERE id = ${Number(row.id)}`;
  }
  return { sent };
}