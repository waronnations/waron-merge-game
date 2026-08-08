// src/lib/game/energy.ts
import {
  EARLY_GAME_MERGES,
  EARLY_GAME_REGEN_MULT,
  ENERGY_REGEN_MS,
  ENERGY_ZONE_REGEN_MULT,
  MAX_ENERGY,
  MID_GAME_MERGES,
  MID_GAME_REGEN_MULT,
  type EnergyTreasuryZone,
} from "@/lib/constants";
import { getActiveEvents, getEnergyRegenMultiplier } from "@/lib/events";
import type { GameState } from "./types";

export type LocalRecoverResult = {
  ok: boolean;
  reason?: string;
  energy?: number;
  spent?: { wardog: number; warcat: number };
};

export function getCombinedEnergyRegenMult(
  totalMerges: number,
  zone: EnergyTreasuryZone = "yellow",
  now = Date.now(),
): number {
  const events = getActiveEvents(now);
  const eventMult = getEnergyRegenMultiplier(events);

  const merges = Number(totalMerges ?? 0);
  let progMult = 1;
  if (merges < EARLY_GAME_MERGES) progMult = EARLY_GAME_REGEN_MULT;
  else if (merges < MID_GAME_MERGES) progMult = MID_GAME_REGEN_MULT;

  const zoneMult = ENERGY_ZONE_REGEN_MULT[zone] ?? 1;
  return eventMult * progMult * zoneMult;
}

/** Merge board is free — only energy is spent. */
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
 * Offline recover never spends unclaimed tokens.
 * Authenticated path: serverRecoverEnergy (spendable only).
 */
export function computeRecoverEnergy(s: GameState): RecoverEnergyOutcome {
  if (s.energy >= MAX_ENERGY) {
    return { ok: false, reason: "energy_full" };
  }
  return { ok: false, reason: "requires_topup" };
}
