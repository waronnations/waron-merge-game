// src/lib/memewar/aggregator/stonfi.server.ts
/** STON.fi quotes via the public /v1/swap/simulate API. v1 router routes are executable. */
import { TON_TARGET, type SwapQuote } from "../types";
import type { QuoteRequest } from "./index.server";

/** STON.fi v1 proxy-TON master (used as ask for "Retreat to TON"). */
export const STONFI_PTON_V1 = "EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez";

type Sim = {
  ask_units: string;
  min_ask_units: string;
  price_impact: string;
  fee_units: string;
  ask_jetton_wallet: string;
  router_address: string;
  router?: { major_version?: number };
  gas_params?: { gas_budget?: string; forward_gas?: string };
};

export async function stonfiQuote(req: QuoteRequest): Promise<SwapQuote> {
  const ask = req.askMaster === TON_TARGET ? STONFI_PTON_V1 : req.askMaster;
  const qs = new URLSearchParams({
    offer_address: req.offerMaster,
    ask_address: ask,
    units: req.offerUnits,
    slippage_tolerance: String(req.slippage),
  });
  const res = await fetch(`https://api.ston.fi/v1/swap/simulate?${qs}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`stonfi_${res.status}`);
  const s = (await res.json()) as Sim;
  if (!s.ask_units) throw new Error("stonfi_no_route");
  const v1 = (s.router?.major_version ?? 1) === 1;
  return {
    provider: "stonfi",
    offerMaster: req.offerMaster,
    askMaster: req.askMaster,
    offerUnits: req.offerUnits,
    askUnits: s.ask_units,
    minAskUnits: s.min_ask_units,
    askDecimals: req.askDecimals,
    priceImpact: Number(s.price_impact ?? 0),
    feeUnits: s.fee_units ?? "0",
    route: [req.offerSymbol, req.askSymbol],
    executable: v1 && Boolean(s.ask_jetton_wallet && s.router_address),
    stonfi: {
      routerAddress: s.router_address,
      askJettonWallet: s.ask_jetton_wallet,
      gasBudget: s.gas_params?.gas_budget ?? "300000000",
      forwardGas: s.gas_params?.forward_gas ?? "240000000",
    },
  };
}
