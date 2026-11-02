// src/lib/memewar/war-math.ts
/** Pure War Mode math — shared by UI and tests. No I/O. */
import {
  MEMEWAR_TAX_BPS,
  MEMEWAR_MIN_TAX_USD,
  MEMEWAR_WARDOG_TAX_MULT,
  MEMEWAR_DEFAULT_SLIPPAGE,
  MEMEWAR_TOTAL_WAR_SLIPPAGE,
  MEMEWAR_TOTAL_WAR_POINTS_MULT,
  MEMEWAR_MAX_POINTS_USD,
  MEMEWAR_SEASON_DAYS,
} from "@/lib/constants/memewar";
import { WARDOG_CA } from "@/lib/tokens";
import type { WarAction, WarHolding } from "./types";

export const ACTION_META: Record<
  WarAction,
  { label: string; blurb: string; share: number; toTon: boolean }
> = {
  absorb: { label: "Absorb into Stronger", blurb: "Your whole weaker stack joins the stronger coin.", share: 1, toTon: false },
  totalWar: { label: "Total War", blurb: "All-in absorb with wider slippage. Double season points.", share: 1, toTon: false },
  alliance: { label: "Form Alliance", blurb: "Send half the weaker stack. Both coins stay on the board.", share: 0.5, toTon: false },
  retreat: { label: "Retreat to TON", blurb: "Pull the weaker stack back to TON. No season points.", share: 1, toTon: true },
};

export function defaultSlippage(action: WarAction): number {
  return action === "totalWar" ? MEMEWAR_TOTAL_WAR_SLIPPAGE : MEMEWAR_DEFAULT_SLIPPAGE;
}

/** Order two tiles: the weaker (lower USD, then lower amount) is the attacker that gets absorbed. */
export function orderBattle(a: WarHolding, b: WarHolding): { weak: WarHolding; strong: WarHolding } {
  if (a.usd !== b.usd) return a.usd < b.usd ? { weak: a, strong: b } : { weak: b, strong: a };
  return a.amount <= b.amount ? { weak: a, strong: b } : { weak: b, strong: a };
}

export function isWardog(master: string): boolean {
  return master === WARDOG_CA;
}

/** War Tax in USD for a swap of `swapUsd`, paid in `taxMaster`. */
export function warTaxUsd(swapUsd: number, taxMaster: string): number {
  const base = Math.max(MEMEWAR_MIN_TAX_USD, (swapUsd * MEMEWAR_TAX_BPS) / 10_000);
  return isWardog(taxMaster) ? base * MEMEWAR_WARDOG_TAX_MULT : base;
}

/** Tax in whole tokens of the tax coin, or null when the coin has no price. */
export function warTaxAmount(swapUsd: number, tax: WarHolding): number | null {
  if (!(tax.coin.priceUsd > 0)) return null;
  return warTaxUsd(swapUsd, tax.coin.master) / tax.coin.priceUsd;
}

/** Amount (whole tokens) of the weak coin that will be swapped. */
export function swapAmount(action: WarAction, weak: WarHolding, taxMaster: string, taxAmount: number | null): number {
  let amt = weak.amount * ACTION_META[action].share;
  if (taxMaster === weak.coin.master && taxAmount) amt = Math.min(amt, weak.amount - taxAmount);
  return Math.max(0, amt);
}

/** Holdings that can cover the War Tax (5% headroom). */
export function eligibleTaxCoins(holdings: WarHolding[], swapUsd: number): WarHolding[] {
  return holdings.filter((h) => {
    const t = warTaxAmount(swapUsd, h);
    return t !== null && h.amount >= t * 1.05;
  });
}

/**
 * Smart default: WARDOG (discounted) if it can pay, otherwise the smallest
 * eligible coin that is not in the battle, otherwise the weak coin itself.
 */
export function pickDefaultTaxCoin(
  holdings: WarHolding[],
  swapUsd: number,
  weakMaster: string,
  strongMaster: string,
): WarHolding | null {
  const eligible = eligibleTaxCoins(holdings, swapUsd);
  const wardog = eligible.find((h) => isWardog(h.coin.master));
  if (wardog) return wardog;
  const bystanders = eligible
    .filter((h) => h.coin.master !== weakMaster && h.coin.master !== strongMaster)
    .sort((a, b) => a.usd - b.usd);
  if (bystanders[0]) return bystanders[0];
  return eligible.find((h) => h.coin.master === weakMaster) ?? eligible[0] ?? null;
}

export function seasonPoints(action: WarAction, usd: number): number {
  if (action === "retreat") return 0;
  const capped = Math.min(Math.max(0, usd), MEMEWAR_MAX_POINTS_USD);
  return action === "totalWar" ? capped * MEMEWAR_TOTAL_WAR_POINTS_MULT : capped;
}

/** Dominance: share of the board's USD value held by the top coin (falls back to amounts when unpriced). */
export function dominance(holdings: WarHolding[]): { top: WarHolding | null; pct: number } {
  if (!holdings.length) return { top: null, pct: 0 };
  const totalUsd = holdings.reduce((s, h) => s + h.usd, 0);
  const key = (h: WarHolding) => (totalUsd > 0 ? h.usd : h.amount);
  const total = totalUsd > 0 ? totalUsd : holdings.reduce((s, h) => s + h.amount, 0);
  const top = [...holdings].sort((a, b) => key(b) - key(a))[0]!;
  return { top, pct: total > 0 ? (key(top) / total) * 100 : 0 };
}

/** Season window containing `now` (Monday 00:00 UTC aligned). */
export function seasonWindow(now = Date.now()): { id: string; startsAt: number; endsAt: number } {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  const endsAt = start + MEMEWAR_SEASON_DAYS * 86_400_000;
  return { id: new Date(start).toISOString().slice(0, 10), startsAt: start, endsAt };
}

export function toUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  const [i, f = ""] = amount.toFixed(Math.min(decimals, 12)).split(".");
  return BigInt(i + f.padEnd(decimals, "0").slice(0, decimals));
}

export function fromUnits(units: string | bigint, decimals: number): number {
  const n = typeof units === "bigint" ? units : BigInt(units || "0");
  return Number(n) / 10 ** decimals;
}
