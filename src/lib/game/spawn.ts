// src/lib/game/spawn.ts
import type { Faction } from "@/lib/units";
import { SPAWN_ENERGY } from "@/lib/constants";
import type { GameState } from "./types";
import { clampEnergy, isCorrectSide, randomFaction, bumpDailyQuest } from "./helpers";

export type SpawnOutcome =
  | {
      ok: true;
      nextState: GameState;
      targetIdx: number;
      faction: Faction;
      unitId: number;
    }
  | { ok: false; reason: string };

export function computeSpawn(s: GameState): SpawnOutcome {
  if (clampEnergy(s.energy) < SPAWN_ENERGY) {
    return { ok: false, reason: "Not enough energy" };
  }

  const dogEmpty: number[] = [];
  const catEmpty: number[] = [];
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] !== null) continue;
    if (isCorrectSide(i, "dog")) dogEmpty.push(i);
    else catEmpty.push(i);
  }

  if (dogEmpty.length + catEmpty.length === 0) {
    return { ok: false, reason: "Board completely full" };
  }

  const preferred: Faction = randomFaction();
  let finalFaction: Faction;
  let pool: number[];

  if (preferred === "dog") {
    if (dogEmpty.length > 0) {
      pool = dogEmpty;
      finalFaction = "dog";
    } else {
      pool = catEmpty;
      finalFaction = "cat";
    }
  } else {
    if (catEmpty.length > 0) {
      pool = catEmpty;
      finalFaction = "cat";
    } else {
      pool = dogEmpty;
      finalFaction = "dog";
    }
  }

  const targetIdx = pool[Math.floor(Math.random() * pool.length)];

  if (!isCorrectSide(targetIdx, finalFaction)) {
    return { ok: false, reason: "Board completely full" };
  }

  const unitId = s.nextId;
  const variant = Math.floor(Math.random() * 3);
  const board = s.board.slice();
  board[targetIdx] = {
    id: unitId,
    faction: finalFaction,
    tier: 1,
    variant,
  };

  let next: GameState = {
    ...s,
    board,
    nextId: s.nextId + 1,
    energy: clampEnergy(s.energy - SPAWN_ENERGY),
    lastRegenAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  next = bumpDailyQuest(next, "spawn", 1);

  return { ok: true, nextState: next, targetIdx, faction: finalFaction, unitId };
}

export function computeRollbackSpawn(
  s: GameState,
  targetIdx: number,
  unitId: number,
): GameState {
  const cell = s.board[targetIdx];
  if (!cell || cell.id !== unitId) return s;
  const board = s.board.slice();
  board[targetIdx] = null;
  return {
    ...s,
    board,
    energy: clampEnergy(s.energy + SPAWN_ENERGY),
  };
}
