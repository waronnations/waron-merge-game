// src/lib/memewar/memewar.functions.ts
/**
 * Public read endpoints (holdings, quotes, season) + merge recording.
 * Quotes/holdings are public on-chain data; recording is idempotent per tx
 * and points are recomputed server-side with a USD cap.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getWalletHoldings, getDemoHoldings, getPrices } from "./tonapi.server";
import { aggregateQuote } from "./aggregator/index.server";
import { getSeason, recordMerge } from "./season.server";
import { seasonPoints } from "./war-math";
import { TON_TARGET } from "./types";

const addr = z.string().min(40).max(70).regex(/^[A-Za-z0-9_\-:]+$/);

export const getWarHoldingsFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ owner: addr.nullable() }).parse(d))
  .handler(async ({ data }) => {
    if (!data.owner) return { demo: true, holdings: await getDemoHoldings() };
    try {
      return { demo: false, holdings: await getWalletHoldings(data.owner) };
    } catch (e) {
      console.error("[memewar] holdings failed", e);
      return { demo: true, holdings: await getDemoHoldings(), error: "holdings_unavailable" };
    }
  });

export const getWarQuoteFn = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
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
  .validator((d: unknown) =>
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
    if (data.toMaster === TON_TARGET) return { recorded: false };
    // Re-price server-side; never trust a client USD figure.
    const price = (await getPrices([data.fromMaster]))[data.fromMaster] ?? 0;
    const usd = data.fromAmount * price;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data.txBoc));
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return recordMerge({
      wallet: data.wallet,
      txBocHash: hash,
      action: data.action,
      fromMaster: data.fromMaster,
      toMaster: data.toMaster,
      toSymbol: data.toSymbol,
      toImage: data.toImage,
      usd,
      points: seasonPoints(data.action, usd),
    });
  });
