// src/lib/memewar/tonapi.server.ts
/** Jetton metadata, prices and wallet holdings via TonAPI v2 (server-only). */
import { Address } from "@ton/core";
import { MEMEWAR_KNOWN_COINS, MEMEWAR_DEMO_AMOUNTS, MEMEWAR_DUST_USD } from "@/lib/constants/memewar";
import type { WarCoin, WarHolding } from "./types";

const BASE = "https://tonapi.io/v2";

function headers(): HeadersInit {
  const key = process.env.TONAPI_KEY;
  return key ? { Accept: "application/json", Authorization: `Bearer ${key}` } : { Accept: "application/json" };
}

async function tonapi<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`tonapi_${res.status}`);
  return (await res.json()) as T;
}

export function friendly(addr: string): string {
  try {
    return Address.parse(addr).toString({ bounceable: true, urlSafe: true });
  } catch {
    return addr;
  }
}

export function rawAddr(addr: string): string {
  return Address.parse(addr).toRawString();
}

function ipfsToHttp(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${url.slice(7)}`;
  return url;
}

type TonapiJettonMeta = {
  address: string;
  name?: string;
  symbol?: string;
  decimals?: string | number;
  image?: string;
};

function toCoin(meta: TonapiJettonMeta, preview: string | undefined, verification: string | undefined, priceUsd: number): WarCoin {
  const raw = ipfsToHttp(meta.image);
  return {
    master: friendly(meta.address),
    symbol: (meta.symbol ?? "???").slice(0, 12),
    name: meta.name ?? meta.symbol ?? "Unknown",
    decimals: Number(meta.decimals ?? 9),
    image: preview || raw,
    imageRaw: raw,
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : 0,
    verified: verification === "whitelist",
  };
}

// --- metadata cache (per isolate) ---------------------------------------
const metaCache = new Map<string, { coin: WarCoin; at: number }>();
const META_TTL = 10 * 60_000;

export async function getPrices(masters: string[]): Promise<Record<string, number>> {
  if (!masters.length) return {};
  try {
    const data = await tonapi<{ rates: Record<string, { prices?: { USD?: number } }> }>(
      `/rates?tokens=${masters.map(encodeURIComponent).join(",")}&currencies=usd`,
    );
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.rates ?? {})) out[friendly(k)] = Number(v.prices?.USD ?? 0);
    return out;
  } catch {
    return {};
  }
}

export async function getCoin(master: string): Promise<WarCoin> {
  const key = friendly(master);
  const hit = metaCache.get(key);
  if (hit && Date.now() - hit.at < META_TTL) return hit.coin;
  const data = await tonapi<{ metadata: TonapiJettonMeta; preview?: string; verification?: string }>(
    `/jettons/${encodeURIComponent(key)}`,
  );
  const coin = toCoin(data.metadata, data.preview, data.verification, 0);
  metaCache.set(key, { coin, at: Date.now() });
  return coin;
}

/** Real wallet holdings (non-dust jettons), sorted by USD desc. */
export async function getWalletHoldings(owner: string): Promise<WarHolding[]> {
  const data = await tonapi<{
    balances: {
      balance: string;
      price?: { prices?: { USD?: number } };
      jetton: TonapiJettonMeta & { image?: string; verification?: string };
    }[];
  }>(`/accounts/${encodeURIComponent(rawAddr(owner))}/jettons?currencies=usd`);

  const holdings: WarHolding[] = [];
  for (const b of data.balances ?? []) {
    if (b.jetton.verification === "blacklist") continue;
    const price = Number(b.price?.prices?.USD ?? 0);
    // TonAPI returns the proxied preview as jetton.image for balances.
    const coin = toCoin(b.jetton, b.jetton.image, b.jetton.verification, price);
    const amount = Number(BigInt(b.balance || "0")) / 10 ** coin.decimals;
    if (amount <= 0) continue;
    const usd = amount * coin.priceUsd;
    if (coin.priceUsd > 0 && usd < MEMEWAR_DUST_USD) continue;
    holdings.push({ coin, balanceUnits: b.balance, amount, usd });
  }
  return holdings.sort((a, b) => b.usd - a.usd || b.amount - a.amount);
}

async function getCoinsBulk(masters: string[]): Promise<Map<string, WarCoin>> {
  const out = new Map<string, WarCoin>();
  const missing = masters.filter((m) => {
    const hit = metaCache.get(friendly(m));
    if (hit && Date.now() - hit.at < META_TTL) out.set(friendly(m), hit.coin);
    return !out.has(friendly(m));
  });
  if (!missing.length) return out;
  const res = await fetch(`${BASE}/jettons/_bulk`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ account_ids: missing }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`tonapi_${res.status}`);
  const data = (await res.json()) as { jettons: { metadata: TonapiJettonMeta; preview?: string; verification?: string }[] };
  for (const j of data.jettons ?? []) {
    const coin = toCoin(j.metadata, j.preview, j.verification, 0);
    metaCache.set(coin.master, { coin, at: Date.now() });
    out.set(coin.master, coin);
  }
  return out;
}

/** Demo board: real metadata + real prices, fake amounts. */
export async function getDemoHoldings(): Promise<WarHolding[]> {
  const masters = MEMEWAR_KNOWN_COINS.map((c) => c.master);
  const [prices, meta] = await Promise.all([
    getPrices(masters),
    getCoinsBulk(masters).catch(() => new Map<string, WarCoin>()),
  ]);
  return MEMEWAR_KNOWN_COINS.map((k) => {
    const base: WarCoin = meta.get(friendly(k.master)) ?? {
      master: k.master, symbol: k.symbol, name: k.symbol, decimals: 9, image: null, imageRaw: null, priceUsd: 0, verified: false,
    };
    const coin = { ...base, priceUsd: prices[base.master] ?? 0 };
    const amount = MEMEWAR_DEMO_AMOUNTS[k.symbol] ?? 1000;
    return {
      coin,
      amount,
      usd: amount * coin.priceUsd,
      balanceUnits: (BigInt(Math.round(amount)) * 10n ** BigInt(coin.decimals)).toString(),
    };
  }).sort((a, b) => b.usd - a.usd || b.amount - a.amount);
}
