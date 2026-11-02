// src/lib/memewar/aggregator/mock.ts
/** Deterministic mock provider (MEMEWAR_AGGREGATOR=mock) for offline dev and tests. */
import type { SwapQuote } from "../types";
import type { QuoteRequest } from "./index.server";

export async function mockQuote(req: QuoteRequest): Promise<SwapQuote> {
  const offer = Number(req.offerUnits) / 10 ** req.offerDecimals;
  const offerUsd = offer * (req.offerPriceUsd || 0.001);
  const askPrice = req.askPriceUsd || 0.001;
  const impact = Math.min(0.25, offerUsd / 200_000);
  const fee = 0.003;
  const ask = (offerUsd / askPrice) * (1 - impact) * (1 - fee);
  const askUnits = BigInt(Math.floor(ask * 10 ** req.askDecimals));
  return {
    provider: "mock",
    offerMaster: req.offerMaster,
    askMaster: req.askMaster,
    offerUnits: req.offerUnits,
    askUnits: askUnits.toString(),
    minAskUnits: ((askUnits * BigInt(Math.round((1 - req.slippage) * 10_000))) / 10_000n).toString(),
    askDecimals: req.askDecimals,
    priceImpact: impact,
    feeUnits: BigInt(Math.floor(ask * fee * 10 ** req.askDecimals)).toString(),
    route: [req.offerSymbol, "TON", req.askSymbol],
    executable: false,
  };
}
