// src/lib/game/energy.ts
// Pure energy regen / recovery logic extracted from the useGame hook.
import {
  EARLY_GAME_MERGES,
  EARLY_GAME_REGEN_MULT,
  ENERGY_REGEN_MS,
  ENERGY_ZONE_REGEN_MULT,
  MAX_ENERGY,
  MID_GAME_MERGES,
  MID_GAME_REGEN_MULT,
  RECOVER_ENERGY_AMOUNT,
  RECOVER_ENERGY_TOKEN_COST,
  type EnergyTreasuryZone,
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

/**
 * Combined regen multiplier.
 * order: events × progression × treasury zone
 */
export function getCombinedEnergyRegenMult(
  totalMerges: number,
  zone: EnergyTreasuryZone = "yellow",
  now = Date.now(),
): number {
  const events = getActiveEvents(now);
  const eventMult = getEnergyRegenMultiplier(events);

  const merges = Number(totalMerges ?? 0);
  let progMult = 1;
  if (merges < EARLY_GAME_MERGES) {
    progMult = EARLY_GAME_REGEN_MULT;
  } else if (merges < MID_GAME_MERGES) {
    progMult = MID_GAME_REGEN_MULT;
  }

  const zoneMult = ENERGY_ZONE_REGEN_MULT[zone] ?? 1;

  return eventMult * progMult * zoneMult;
}

/**
 * One tick (1s interval) of passive energy regeneration.
 * Pass the current Claim Treasury zone so regen stays in sync with health.
 *
 * Merge board remains free — only energy is spent.
 */
export function energyRegenTick(
  s: GameState,
  treasuryZone: EnergyTreasuryZone = "yellow",
): GameState | null {
  if (s.energy >= MAX_ENERGY) {
    return { ...s, energy: MAX_ENERGY, lastRegenAt: Date.now() };
  }

  const now = Date.now();
  const last =
    typeof s.lastRegenAt === "number" && s.lastRegenAt > 0
      ? s.lastRegenAt
      : now;

  const energyMult = getCombinedEnergyRegenMult(
    Number(s.totalMerges ?? 0),
    treasuryZone,
    now,
  );

  const gained = Math.floor(((now - last) / ENERGY_REGEN_MS) * energyMult);
  if (gained <= 0) return null;

  return {
    ...s,
    energy: Math.min(MAX_ENERGY, s.energy + gained),
    lastRegenAt: last + Math.floor((gained * ENERGY_REGEN_MS) / energyMult),
  };
}

export type RecoverEnergyOutcome =
  | {
      ok: true;
      nextState: GameState;
      energy: number;
      spent: { wardog: number; warcat: number };
    }
  | { ok: false; reason: string };

/**
 * Local / offline recover helper.
 * Authenticated path must go through serverRecoverEnergy (spendable-only + tax).
 */
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
