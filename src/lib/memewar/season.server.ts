// src/lib/memewar/season.server.ts
/** Seasonal memecoin war ranking (Neon). Falls back to a mock ranking without a DB. */
import { sql, hasDatabase } from "@/lib/db/client.server";
import { MEMEWAR_DAILY_MISSION_TARGET, MEMEWAR_FEED_LIMIT } from "@/lib/constants/memewar";
import { seasonWindow } from "./war-math";
import type { SeasonInfo, SeasonRankEntry } from "./types";
import { battleStreak } from "./battle-evidence";

let schemaReady: Promise<void> | null = null;
export function ensureWarSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS memewar_merges (
        id BIGSERIAL PRIMARY KEY,
        season TEXT NOT NULL,
        wallet TEXT NOT NULL,
        tx_boc_hash TEXT UNIQUE,
        action TEXT NOT NULL,
        from_master TEXT NOT NULL,
        to_master TEXT NOT NULL,
        to_symbol TEXT NOT NULL,
        to_image TEXT,
        usd NUMERIC NOT NULL DEFAULT 0,
        points NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS memewar_merges_season_idx ON memewar_merges (season, to_master)`;
    await sql`ALTER TABLE memewar_merges ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE memewar_merges ADD COLUMN IF NOT EXISTS user_id BIGINT`;
    await sql`ALTER TABLE memewar_merges ADD COLUMN IF NOT EXISTS from_symbol TEXT`;
    await sql`ALTER TABLE memewar_merges ADD COLUMN IF NOT EXISTS from_amount NUMERIC NOT NULL DEFAULT 0`;
    await sql`CREATE TABLE IF NOT EXISTS memewar_intents (id UUID PRIMARY KEY, user_id BIGINT NOT NULL, payload JSONB NOT NULL, message_hash TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending', event_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS memewar_preferences (user_id BIGINT PRIMARY KEY, champion TEXT, alerts BOOLEAN NOT NULL DEFAULT FALSE, last_rank INTEGER, last_alert_at TIMESTAMPTZ)`;
    await sql`CREATE TABLE IF NOT EXISTS memewar_badges (user_id BIGINT NOT NULL, badge TEXT NOT NULL, earned_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, badge))`;
    await sql`CREATE TABLE IF NOT EXISTS memewar_alerts (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, telegram_id BIGINT NOT NULL, text TEXT NOT NULL, dedup_key TEXT UNIQUE NOT NULL, sent_at TIMESTAMPTZ, attempts INTEGER NOT NULL DEFAULT 0, retry_at TIMESTAMPTZ NOT NULL DEFAULT now(), locked_until TIMESTAMPTZ)`;
  })().catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

async function rankingFor(season: string): Promise<SeasonRankEntry[]> {
  const { rows } = await sql`
    SELECT to_master, MAX(to_symbol) AS symbol, MAX(to_image) AS image,
           SUM(points)::float AS points, COUNT(*)::int AS merges
    FROM memewar_merges WHERE season = ${season} AND points > 0 AND verified = TRUE
    GROUP BY to_master ORDER BY points DESC LIMIT 25`;
  return rows.map((r) => ({
    master: String(r.to_master),
    symbol: String(r.symbol),
    image: (r.image as string | null) ?? null,
    points: Number(r.points),
    merges: Number(r.merges),
  }));
}

export async function getSeason(): Promise<SeasonInfo> {
  const w = seasonWindow();
  const prev = seasonWindow(w.startsAt - 1);
  if (!hasDatabase()) {
    return { ...w, ranking: [], previousWinner: null, mode: "mock", feed: [], leaders: [], rally: [] };
  }
  await ensureWarSchema();
  const [ranking, prevRanking, feed, leaders, rally] = await Promise.all([
    rankingFor(w.id), rankingFor(prev.id),
    sql`SELECT tx_boc_hash, wallet, from_symbol, to_symbol, from_amount, points, created_at FROM memewar_merges WHERE verified = TRUE ORDER BY created_at DESC LIMIT ${MEMEWAR_FEED_LIMIT}`,
    sql`SELECT wallet, SUM(points)::float AS points, COUNT(*)::int AS battles FROM memewar_merges WHERE verified = TRUE AND season = ${w.id} GROUP BY wallet ORDER BY points DESC LIMIT 10`,
    sql`SELECT champion, COUNT(*)::int AS supporters FROM memewar_preferences WHERE champion IS NOT NULL GROUP BY champion`,
  ]);
  return { ...w, ranking, previousWinner: prevRanking[0] ?? null, mode: "live",
    feed: feed.rows.map(r => ({ id: String(r.tx_boc_hash), wallet: String(r.wallet), fromSymbol: String(r.from_symbol), toSymbol: String(r.to_symbol), amount: Number(r.from_amount), points: Number(r.points), createdAt: new Date(String(r.created_at)).getTime() })),
    leaders: leaders.rows.map(r => ({ wallet: String(r.wallet), points: Number(r.points), battles: Number(r.battles) })),
    rally: rally.rows.map(r => ({ master: String(r.champion), supporters: Number(r.supporters) })),
  };
}

export async function recordMerge(input: {
  wallet: string;
  txBocHash: string;
  action: string;
  fromMaster: string;
  toMaster: string;
  toSymbol: string;
  toImage: string | null;
  usd: number;
  points: number;
}): Promise<{ recorded: boolean }> {
  if (!hasDatabase()) return { recorded: false };
  await ensureWarSchema();
  const { id } = seasonWindow();
  const { rowCount } = await sql`
    INSERT INTO memewar_merges (season, wallet, tx_boc_hash, action, from_master, to_master, to_symbol, to_image, usd, points)
    VALUES (${id}, ${input.wallet}, ${input.txBocHash}, ${input.action}, ${input.fromMaster}, ${input.toMaster},
            ${input.toSymbol}, ${input.toImage}, ${input.usd}, ${input.points})
    ON CONFLICT (tx_boc_hash) DO NOTHING RETURNING id`;
  return { recorded: rowCount > 0 };
}

export async function getWarProfile(userId: number) {
  await ensureWarSchema();
  const [prefs, days, badges] = await Promise.all([
    sql`SELECT champion, alerts FROM memewar_preferences WHERE user_id = ${userId}`,
    sql`SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*)::int AS battles FROM memewar_merges WHERE verified = TRUE AND user_id = ${userId} GROUP BY day ORDER BY day DESC`,
    sql`SELECT badge FROM memewar_badges WHERE user_id = ${userId}`,
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return { champion: prefs.rows[0]?.champion ? String(prefs.rows[0].champion) : null, alerts: Boolean(prefs.rows[0]?.alerts), battlesToday: Number(days.rows.find(r => r.day === today)?.battles ?? 0), streak: battleStreak(days.rows.map(r => String(r.day))), badges: badges.rows.map(r => String(r.badge)) };
}

export async function claimBattleMission(userId: number) {
  await ensureWarSchema();
  const day = new Date().toISOString().slice(0, 10);
  const badge = `battle_mission_${day}`;
  const result = await sql`INSERT INTO memewar_badges (user_id, badge)
    SELECT ${userId}, ${badge} WHERE (SELECT COUNT(*) FROM memewar_merges WHERE user_id = ${userId} AND verified = TRUE AND (created_at AT TIME ZONE 'UTC')::date = ${day}::date) >= ${MEMEWAR_DAILY_MISSION_TARGET}
    ON CONFLICT DO NOTHING RETURNING badge`;
  return { awarded: result.rowCount > 0, profile: await getWarProfile(userId) };
}
