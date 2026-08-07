// src/lib/game/energy.ts
// Pure energy regen / recovery logic extracted from the useGame hook.
import {
  EARLY_GAME_MERGES,
  EARLY_GAME_REGEN_MULT,
  ENERGY_REGEN_MS,
  MAX_ENERGY,
  RECOVER_ENERGY_AMOUNT,
  RECOVER_ENERGY_TOKEN_COST,
} from "@/lib/constants";
import { getActiveEvents, getEnergyRegenMultiplier } from "@/lib/events";
import type { GameState } from "./types";

/** Result of the offline (unauthenticated) energy recovery. */
export type LocalRecoverResult = {
  ok: boolean;
  reason?: string;
  energy?: number;
  spent?: { wardog: number; warcat: number };
};

/** One tick (1s interval) of passive energy regeneration. */
export function energyRegenTick(s: GameState): GameState | null {
  if (s.energy >= MAX_ENERGY) {
    return { ...s, energy: MAX_ENERGY, lastRegenAt: Date.now() };
  }
  const now = Date.now();
  const last =
    typeof s.lastRegenAt === "number" && s.lastRegenAt > 0
      ? s.lastRegenAt
      : now;
  const events = getActiveEvents(now);
  const eventMult = getEnergyRegenMultiplier(events);
  const earlyMult =
    Number(s.totalMerges ?? 0) < EARLY_GAME_MERGES ? EARLY_GAME_REGEN_MULT : 1;
  const energyMult = eventMult * earlyMult;
  const gained = Math.floor(((now - last) / ENERGY_REGEN_MS) * energyMult);
  if (gained <= 0) return null;
  return {
    ...s,
    energy: Math.min(MAX_ENERGY, s.energy + gained),
    lastRegenAt: last + Math.floor((gained * ENERGY_REGEN_MS) / energyMult),
  };
}

export type RecoverEnergyOutcome =
  | { ok: true; nextState: GameState; energy: number; spent: { wardog: number; warcat: number } }
  | { ok: false; reason: string };

export function computeRecoverEnergy(s: GameState): RecoverEnergyOutcome {
  if (s.energy >= MAX_ENERGY) {
    return { ok: false, reason: "energy_full" };
  }
  const total = s.wardogTokens + s.warcatTokens;
  if (total < RECOVER_ENERGY_TOKEN_COST) {
    return { ok: false, reason: "no_tokens" };
  }

  let remaining = RECOVER_ENERGY_TOKEN_COST;
  let spentWardog = 0;
  let spentWarcat = 0;

  if (s.wardogTokens >= remaining) {
    spentWardog = remaining;
    remaining = 0;
  } else {
    spentWardog = s.wardogTokens;
    remaining -= s.wardogTokens;
  }
  if (remaining > 0) {
    spentWarcat = remaining;
  }

  const nextState: GameState = {
    ...s,
    energy: Math.min(MAX_ENERGY, s.energy + RECOVER_ENERGY_AMOUNT),
    wardogTokens: Math.max(0, s.wardogTokens - spentWardog),
    warcatTokens: Math.max(0, s.warcatTokens - spentWarcat),
    lastRegenAt: Date.now(),
    lastSeenAt: Date.now(),
  };

  return {
    ok: true,
    nextState,
    energy: RECOVER_ENERGY_AMOUNT,
    spent: { wardog: spentWardog, warcat: spentWarcat },
  };
}
