// src/lib/memewar/season.server.ts
/** Seasonal memecoin war ranking (Neon). Falls back to a mock ranking without a DB. */
import { sql, hasDatabase } from "@/lib/db/client.server";
import { MEMEWAR_KNOWN_COINS } from "@/lib/constants/memewar";
import { seasonWindow } from "./war-math";
import type { SeasonInfo, SeasonRankEntry } from "./types";

let schemaReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
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
  })().catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

function mockRanking(seasonId: string): SeasonRankEntry[] {
  let seed = [...seasonId].reduce((s, c) => s + c.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  return MEMEWAR_KNOWN_COINS.map((c) => ({
    master: c.master,
    symbol: c.symbol,
    image: null,
    points: Math.round(5_000 + rnd() * 95_000),
    merges: Math.round(20 + rnd() * 400),
  })).sort((a, b) => b.points - a.points);
}

async function rankingFor(season: string): Promise<SeasonRankEntry[]> {
  const { rows } = await sql`
    SELECT to_master, MAX(to_symbol) AS symbol, MAX(to_image) AS image,
           SUM(points)::float AS points, COUNT(*)::int AS merges
    FROM memewar_merges WHERE season = ${season} AND points > 0
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
    return { ...w, ranking: mockRanking(w.id), previousWinner: mockRanking(prev.id)[0] ?? null, mode: "mock" };
  }
  await ensureTable();
  const [ranking, prevRanking] = await Promise.all([rankingFor(w.id), rankingFor(prev.id)]);
  return { ...w, ranking, previousWinner: prevRanking[0] ?? null, mode: "live" };
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
  await ensureTable();
  const { id } = seasonWindow();
  const { rowCount } = await sql`
    INSERT INTO memewar_merges (season, wallet, tx_boc_hash, action, from_master, to_master, to_symbol, to_image, usd, points)
    VALUES (${id}, ${input.wallet}, ${input.txBocHash}, ${input.action}, ${input.fromMaster}, ${input.toMaster},
            ${input.toSymbol}, ${input.toImage}, ${input.usd}, ${input.points})
    ON CONFLICT (tx_boc_hash) DO NOTHING RETURNING id`;
  return { recorded: rowCount > 0 };
}
