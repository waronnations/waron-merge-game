// src/lib/memewar/types.ts
/** Shared (client + server) types for the Memecoin War Board. */

export interface WarCoin {
  /** Jetton master, user-friendly bounceable form. */
  master: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Best logo URL (TonAPI image proxy preferred). */
  image: string | null;
  /** Raw metadata image (fallback). */
  imageRaw: string | null;
  priceUsd: number;
  verified: boolean;
  change24h?: number | null;
}

export interface WarHolding {
  coin: WarCoin;
  /** Balance in base units (string bigint). */
  balanceUnits: string;
  /** Human amount. */
  amount: number;
  usd: number;
}

export type AggregatorProvider = "stonfi" | "dedust" | "mock";

/** Special ask target: native TON. */
export const TON_TARGET = "TON";

export interface SwapQuote {
  provider: AggregatorProvider;
  offerMaster: string;
  askMaster: string; // jetton master or TON_TARGET
  offerUnits: string;
  askUnits: string;
  minAskUnits: string;
  askDecimals: number;
  /** Fraction, 0.01 = 1%. */
  priceImpact: number;
  /** Pool/LP fee expressed in ask units. */
  feeUnits: string;
  /** Human-readable hops, e.g. ["NOT", "TON", "DOGS"]. */
  route: string[];
  /** True when this app can build the on-chain transaction for this quote. */
  executable: boolean;
  /** STON.fi v1 execution data. */
  stonfi?: {
    routerAddress: string;
    askJettonWallet: string;
    gasBudget: string; // nanoton
    forwardGas: string; // nanoton
  };
}

export interface AggregatedQuote {
  best: SwapQuote | null;
  /** Best executable quote (may differ from `best`). */
  execution: SwapQuote | null;
  quotes: SwapQuote[];
  errors: { provider: AggregatorProvider; message: string }[];
  mode: "live" | "mock";
  fetchedAt: number;
}

export type WarAction = "absorb" | "totalWar" | "alliance" | "retreat";

export interface SeasonRankEntry {
  master: string;
  symbol: string;
  image: string | null;
  points: number;
  merges: number;
}

export interface SeasonInfo {
  id: string;
  startsAt: number;
  endsAt: number;
  ranking: SeasonRankEntry[];
  previousWinner: SeasonRankEntry | null;
  mode: "live" | "mock";
  feed?: BattleFeedEntry[];
  leaders?: { wallet: string; points: number; battles: number }[];
  rally?: { master: string; supporters: number }[];
}

export interface BattleFeedEntry {
  id: string;
  wallet: string;
  fromSymbol: string;
  toSymbol: string;
  amount: number;
  points: number;
  createdAt: number;
}

export interface WarProfile {
  champion: string | null;
  alerts: boolean;
  battlesToday: number;
  streak: number;
  badges: string[];
}
