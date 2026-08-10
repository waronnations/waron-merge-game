// src/lib/game/spawn.ts
import type { Faction } from "@/lib/units";
import { SPAWN_ENERGY } from "@/lib/constants";
import type { GameState } from "./types";
import {
  clampEnergy,
  isCorrectSide,
  bumpDailyQuest,
  pickSmartVariant,
  updateConquerFlags,
} from "./helpers";

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

  // Prefer the side already closer to conquest
  let dogHybridCount = 0;
  let catHybridCount = 0;
  for (let i = 0; i < s.board.length; i++) {
    const cell = s.board[i];
    if (!cell || cell.faction !== "hybrid") continue;
    if (isCorrectSide(i, "dog")) dogHybridCount++;
    else catHybridCount++;
  }

  const preferDog =
    dogHybridCount > catHybridCount
      ? Math.random() < 0.72
      : catHybridCount > dogHybridCount
        ? Math.random() < 0.28
        : Math.random() < 0.5;

  let finalFaction: Faction;
  let pool: number[];

  if (preferDog) {
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

  const targetIdx = pool[Math.floor(Math.random() * pool.length)]!;

  if (!isCorrectSide(targetIdx, finalFaction)) {
    return { ok: false, reason: "Board completely full" };
  }

  const variant = pickSmartVariant(s.board, finalFaction);

  const unitId = s.nextId;
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
  next = updateConquerFlags(next); // ← Conquest Event check after spawn

  return {
    ok: true,
    nextState: next,
    targetIdx,
    faction: finalFaction,
    unitId,
  };
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
