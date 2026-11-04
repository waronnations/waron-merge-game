import { describe, it, expect } from "vitest";
import { warTaxUsd, swapAmount, pickDefaultTaxCoin, seasonPoints, orderBattle, toUnits, seasonWindow } from "../war-math";
import { WARDOG_CA } from "@/lib/tokens";
import type { WarHolding } from "../types";

const h = (master: string, symbol: string, amount: number, price: number): WarHolding => ({
  coin: { master, symbol, name: symbol, decimals: 9, image: null, imageRaw: null, priceUsd: price, verified: true },
  amount, usd: amount * price, balanceUnits: "0",
});
const A = h("A".repeat(48), "AAA", 1000, 0.01); // $10
const B = h("B".repeat(48), "BBB", 1000, 1); // $1000
const WD = h(WARDOG_CA, "WARDOG", 10_000, 0.001); // $10

describe("memecoin war math", () => {
  it("war tax is 0.5% with a $0.05 floor", () => {
    expect(warTaxUsd(1000, "X")).toBeCloseTo(5);
    expect(warTaxUsd(1, "X")).toBeCloseTo(0.05);
  });
  it("paying in WARDOG halves the tax", () => {
    expect(warTaxUsd(1000, WARDOG_CA)).toBeCloseTo(2.5);
  });
  it("alliance swaps half, absorb swaps all", () => {
    expect(swapAmount("alliance", A, "other", 1)).toBe(500);
    expect(swapAmount("absorb", A, "other", 1)).toBe(1000);
  });
  it("tax paid in the attacking coin is taken out of the swap", () => {
    expect(swapAmount("absorb", A, A.coin.master, 5)).toBe(995);
  });
  it("defaults the tax coin to WARDOG when it can pay", () => {
    expect(pickDefaultTaxCoin([A, B, WD], 10, A.coin.master, B.coin.master)?.coin.symbol).toBe("WARDOG");
  });
  it("total war doubles points, retreat earns none", () => {
    expect(seasonPoints("totalWar", 100)).toBe(200);
    expect(seasonPoints("retreat", 100)).toBe(0);
    expect(seasonPoints("absorb", 50_000)).toBe(10_000);
  });
  it("weaker coin by USD is the attacker", () => {
    expect(orderBattle(B, A).weak.coin.symbol).toBe("AAA");
  });
  it("converts amounts to base units exactly", () => {
    expect(toUnits(1.5, 9)).toBe(1_500_000_000n);
  });
  it("seasons start on Monday UTC and last 7 days", () => {
    const w = seasonWindow(Date.UTC(2026, 10, 4, 12)); // Wed
    expect(w.id).toBe("2026-11-02");
    expect(w.endsAt - w.startsAt).toBe(7 * 86_400_000);
  });
});
