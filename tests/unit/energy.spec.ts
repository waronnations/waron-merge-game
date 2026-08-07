import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { energyRegenTick, computeRecoverEnergy } from "@/lib/game/energy";
import { applyOfflineEnergyRegen, clampEnergy } from "@/lib/game/helpers";
import { initialState } from "@/lib/game/helpers";
import {
  MAX_ENERGY,
  ENERGY_REGEN_MS,
  RECOVER_ENERGY_AMOUNT,
  RECOVER_ENERGY_TOKEN_COST,
} from "@/lib/constants";
import type { GameState } from "@/lib/game/types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...initialState(), board: Array(36).fill(null), ...overrides };
}

describe("clampEnergy", () => {
  it("clamps negative and NaN to 0", () => {
    expect(clampEnergy(-5)).toBe(0);
    expect(clampEnergy(NaN)).toBe(0);
    expect(clampEnergy("x")).toBe(0);
  });
  it("clamps above MAX_ENERGY", () => {
    expect(clampEnergy(MAX_ENERGY + 500)).toBe(MAX_ENERGY);
  });
  it("passes through valid values", () => {
    expect(clampEnergy(42)).toBe(42);
  });
});

describe("energyRegenTick", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns full energy state when already at cap", () => {
    const s = baseState({ energy: MAX_ENERGY });
    const next = energyRegenTick(s);
    expect(next?.energy).toBe(MAX_ENERGY);
  });

  it("returns null when not enough time elapsed for +1 energy", () => {
    const now = Date.now();
    const s = baseState({ energy: 10, lastRegenAt: now, totalMerges: 999 });
    vi.setSystemTime(now + 1000);
    expect(energyRegenTick(s)).toBeNull();
  });

  it("regenerates energy proportional to elapsed time (post early-game)", () => {
    const now = Date.now();
    const s = baseState({ energy: 10, lastRegenAt: now, totalMerges: 999 });
    vi.setSystemTime(now + ENERGY_REGEN_MS * 3);
    const next = energyRegenTick(s);
    expect(next).not.toBeNull();
    expect(next!.energy).toBe(13);
  });
});

describe("applyOfflineEnergyRegen", () => {
  it("caps energy at MAX_ENERGY and never exceeds", () => {
    const now = Date.now();
    const s = baseState({ energy: MAX_ENERGY - 1, lastRegenAt: now - ENERGY_REGEN_MS * 10 });
    const next = applyOfflineEnergyRegen(s);
    expect(next.energy).toBe(MAX_ENERGY);
  });

  it("resets lastRegenAt to now for corrupt/future timestamps", () => {
    const now = Date.now();
    const s = baseState({ energy: 5, lastRegenAt: now + 120_000 });
    const next = applyOfflineEnergyRegen(s);
    expect(next.lastRegenAt).toBeGreaterThanOrEqual(now);
    expect(next.energy).toBe(5);
  });
});

describe("computeRecoverEnergy", () => {
  it("fails when energy already full", () => {
    const s = baseState({ energy: MAX_ENERGY });
    const out = computeRecoverEnergy(s);
    expect(out.ok).toBe(false);
  });

  it("fails when tokens are insufficient", () => {
    const s = baseState({ energy: 0, wardogTokens: 0, warcatTokens: 0 });
    const out = computeRecoverEnergy(s);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("no_tokens");
  });

  it("spends wardog tokens first, then warcat, and grants energy", () => {
    const s = baseState({ energy: 0, wardogTokens: 0.5, warcatTokens: 5 });
    const out = computeRecoverEnergy(s);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.energy).toBe(RECOVER_ENERGY_AMOUNT);
      expect(out.spent.wardog).toBe(0.5);
      expect(out.spent.warcat).toBeCloseTo(RECOVER_ENERGY_TOKEN_COST - 0.5);
      expect(out.nextState.wardogTokens).toBe(0);
    }
  });
});
