// src/lib/memewar/aggregator/index.server.ts
/**
 * Swap aggregator: asks every provider in parallel and picks the best route.
 * Mode is swappable via MEMEWAR_AGGREGATOR=live|mock (default live).
 */
import type { AggregatedQuote, AggregatorProvider, SwapQuote } from "../types";
import { stonfiQuote } from "./stonfi.server";
import { dedustQuote } from "./dedust.server";
import { mockQuote } from "./mock";

export interface QuoteRequest {
  offerMaster: string;
  offerSymbol: string;
  offerDecimals: number;
  askMaster: string; // jetton master or "TON"
  askSymbol: string;
  askDecimals: number;
  offerUnits: string;
  slippage: number;
  /** Used by the mock provider only. */
  offerPriceUsd?: number;
  askPriceUsd?: number;
}

export interface QuoteProvider {
  id: AggregatorProvider;
  quote(req: QuoteRequest): Promise<SwapQuote>;
}

const LIVE: QuoteProvider[] = [
  { id: "stonfi", quote: stonfiQuote },
  { id: "dedust", quote: dedustQuote },
];
const MOCK: QuoteProvider[] = [{ id: "mock", quote: mockQuote }];

export function aggregatorMode(): "live" | "mock" {
  return process.env.MEMEWAR_AGGREGATOR === "mock" ? "mock" : "live";
}

export async function aggregateQuote(req: QuoteRequest): Promise<AggregatedQuote> {
  const mode = aggregatorMode();
  const providers = mode === "mock" ? MOCK : LIVE;
  const settled = await Promise.allSettled(providers.map((p) => p.quote(req)));

  const quotes: SwapQuote[] = [];
  const errors: AggregatedQuote["errors"] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled" && BigInt(r.value.askUnits) > 0n) quotes.push(r.value);
    else errors.push({ provider: providers[i]!.id, message: r.status === "rejected" ? String((r.reason as Error)?.message ?? r.reason) : "no_liquidity" });
  });

  quotes.sort((a, b) => (BigInt(b.askUnits) > BigInt(a.askUnits) ? 1 : -1));
  return {
    best: quotes[0] ?? null,
    execution: quotes.find((q) => q.executable) ?? null,
    quotes,
    errors,
    mode,
    fetchedAt: Date.now(),
  };
}
