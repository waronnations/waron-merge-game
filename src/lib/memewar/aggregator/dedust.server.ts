// src/lib/memewar/aggregator/dedust.server.ts
/**
 * DeDust quotes via /v2/routing/plan (multi-hop aware).
 * Execution through DeDust vaults is not wired yet, so quotes are
 * comparison-only (executable: false) — the aggregator falls back to
 * the best executable provider.
 */
import { Address } from "@ton/core";
import { TON_TARGET, type SwapQuote } from "../types";
import type { QuoteRequest } from "./index.server";

type Step = { pool: { address: string; tradeFee?: string }; assetIn: string; assetOut: string; amountIn: string; amountOut: string; tradeFee?: string };

function asset(master: string): string {
  return master === TON_TARGET ? "native" : `jetton:${Address.parse(master).toRawString()}`;
}

/** Mid-price impact estimate from pool reserves is not returned; approximate via fee-free spot of tiny trade. */
export async function dedustQuote(req: QuoteRequest): Promise<SwapQuote> {
  const plan = async (amount: string) => {
    const res = await fetch("https://api.dedust.io/v2/routing/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ from: asset(req.offerMaster), to: asset(req.askMaster), amount }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`dedust_${res.status}`);
    return (await res.json()) as Step[][];
  };

  const routes = await plan(req.offerUnits);
  if (!routes.length || !routes[0]!.length) throw new Error("dedust_no_route");
  const best = routes.reduce((a, b) =>
    BigInt(b[b.length - 1]!.amountOut) > BigInt(a[a.length - 1]!.amountOut) ? b : a,
  );
  const out = BigInt(best[best.length - 1]!.amountOut);

  // Price impact: compare with a 1/1000 probe trade scaled up.
  let priceImpact = 0;
  try {
    const probeIn = BigInt(req.offerUnits) / 1000n;
    if (probeIn > 0n) {
      const probe = await plan(probeIn.toString());
      const pOut = probe[0] ? BigInt(probe[0][probe[0].length - 1]!.amountOut) : 0n;
      const ideal = pOut * 1000n;
      if (ideal > 0n) priceImpact = Math.max(0, Number(ideal - out) / Number(ideal));
    }
  } catch {
    /* impact stays 0 */
  }

  const minOut = (out * BigInt(Math.round((1 - req.slippage) * 10_000))) / 10_000n;
  const last = best[best.length - 1]!;
  const hops = [req.offerSymbol, ...best.slice(0, -1).map((s) => (s.assetOut === "native" ? "TON" : "…")), req.askSymbol];
  return {
    provider: "dedust",
    offerMaster: req.offerMaster,
    askMaster: req.askMaster,
    offerUnits: req.offerUnits,
    askUnits: out.toString(),
    minAskUnits: minOut.toString(),
    askDecimals: req.askDecimals,
    priceImpact,
    feeUnits: last.tradeFee ?? "0",
    route: hops,
    executable: false,
  };
}
