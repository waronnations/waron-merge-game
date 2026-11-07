// src/lib/memewar/memewar.functions.ts
/**
 * Public read endpoints (holdings, quotes, season) + merge recording.
 * Quotes/holdings are public on-chain data; recording is idempotent per tx
 * and points are recomputed server-side with a USD cap.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getWalletHoldings, getDemoHoldings, rawAddr } from "./tonapi.server";
import { aggregateQuote } from "./aggregator/index.server";
import { getSeason, ensureWarSchema, getWarProfile, claimBattleMission } from "./season.server";
import { requireUserId } from "@/lib/auth.server";
import { sql } from "@/lib/db/client.server";
import { prepareBattle, confirmBattle } from "./battle.server";
import { TON_TARGET } from "./types";

const addr = z.string().min(40).max(70).regex(/^[A-Za-z0-9_\-:]+$/);

export const getWarHoldingsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ owner: addr.nullable() }).parse(d))
  .handler(async ({ data }) => {
    if (!data.owner) return { demo: true, holdings: await getDemoHoldings() };
    try {
      return { demo: false, holdings: await getWalletHoldings(data.owner) };
    } catch (e) {
      console.error("[memewar] holdings failed", e);
      return { demo: false, holdings: [], error: "holdings_unavailable" };
    }
  });

export const getWarQuoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        offerMaster: addr,
        offerSymbol: z.string().max(16),
        offerDecimals: z.number().int().min(0).max(18),
        askMaster: z.union([addr, z.literal(TON_TARGET)]),
        askSymbol: z.string().max(16),
        askDecimals: z.number().int().min(0).max(18),
        offerUnits: z.string().regex(/^\d{1,40}$/),
        slippage: z.number().min(0.001).max(0.2),
        offerPriceUsd: z.number().min(0).optional(),
        askPriceUsd: z.number().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => aggregateQuote(data));

export const getWarSeasonFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await getSeason();
  } catch (e) {
    console.error("[memewar] season failed", e);
    return null;
  }
});

export const recordWarMergeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        wallet: addr,
        txBoc: z.string().min(16).max(20_000),
        action: z.enum(["absorb", "totalWar", "alliance", "retreat"]),
        fromMaster: addr,
        fromAmount: z.number().positive(),
        toMaster: z.union([addr, z.literal(TON_TARGET)]),
        toSymbol: z.string().max(16),
        toImage: z.string().url().max(500).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireUserId();
    void data;
    // Compatibility endpoint: unsigned client reports cannot award points.
    return { recorded: false };
  });

export const prepareWarBattleFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ owner: addr, from: addr, to: z.union([addr, z.literal(TON_TARGET)]), action: z.enum(["absorb", "totalWar", "alliance", "retreat"]), taxMaster: addr, slippage: z.number().min(0.001).max(0.2) }).parse(d))
  .handler(({ data }) => prepareBattle(data));

export const confirmWarBattleFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), txBoc: z.string().min(16).max(20_000).optional() }).parse(d))
  .handler(({ data }) => confirmBattle(data.id, data.txBoc));

export const getWarProfileFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.undefined().parse(d))
  .handler(async () => getWarProfile(await requireUserId()));

export const setWarPreferencesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ champion: addr.nullable(), alerts: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    await ensureWarSchema();
    const champion = data.champion ? rawAddr(data.champion) : null;
    await sql`INSERT INTO memewar_preferences (user_id, champion, alerts) VALUES (${userId}, ${champion}, ${data.alerts}) ON CONFLICT (user_id) DO UPDATE SET champion = EXCLUDED.champion, alerts = EXCLUDED.alerts, last_rank = NULL`;
    return getWarProfile(userId);
  });

export const claimWarMissionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.undefined().parse(d))
  .handler(async () => claimBattleMission(await requireUserId()));
