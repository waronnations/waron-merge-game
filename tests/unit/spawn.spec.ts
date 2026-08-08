import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeSpawn, computeRollbackSpawn } from "@/lib/game/spawn";
import { initialState } from "@/lib/game/helpers";
import { SPAWN_ENERGY, MAX_ENERGY } from "@/lib/constants";
import type { GameState } from "@/lib/game/types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...initialState(), board: Array(36).fill(null), ...overrides };
}

describe("computeSpawn", () => {
  it("fails when not enough energy", () => {
    const s = baseState({ energy: SPAWN_ENERGY - 1 });
    const out = computeSpawn(s);
    expect(out.ok).toBe(false);
  });

  it("fails when board is completely full", () => {
    const board = Array(36).fill({ id: 1, faction: "dog", tier: 1 });
    const s = baseState({ energy: MAX_ENERGY, board });
    const out = computeSpawn(s);
    expect(out.ok).toBe(false);
  });

  it("spawns a unit on an empty cell and deducts energy", () => {
    const s = baseState({ energy: MAX_ENERGY });
    const out = computeSpawn(s);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.nextState.energy).toBe(MAX_ENERGY - SPAWN_ENERGY);
      expect(out.nextState.board[out.targetIdx]).toMatchObject({
        faction: out.faction,
        tier: 1,
      });
    }
  });

  it("falls back to the other side when preferred side is full", () => {
    // Fill entire dog side (cols 0-2), leave cat side empty.
    const board = Array(36).fill(null);
    for (let i = 0; i < 36; i++) {
      const col = i % 6;
      if (col < 3) board[i] = { id: i + 1, faction: "dog", tier: 1 };
    }
    const s = baseState({ energy: MAX_ENERGY, board });
    const out = computeSpawn(s);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.faction).toBe("cat");
    }
  });
});

describe("computeRollbackSpawn", () => {
  it("removes the spawned unit and refunds energy", () => {
    const board = Array(36).fill(null);
    board[0] = { id: 42, faction: "dog", tier: 1 };
    const s = baseState({ energy: 10, board });
    const next = computeRollbackSpawn(s, 0, 42);
    expect(next.board[0]).toBeNull();
    expect(next.energy).toBe(10 + SPAWN_ENERGY);
  });

  it("no-ops if the unit id does not match", () => {
    const board = Array(36).fill(null);
    board[0] = { id: 42, faction: "dog", tier: 1 };
    const s = baseState({ energy: 10, board });
    const next = computeRollbackSpawn(s, 0, 999);
    expect(next).toBe(s);
  });
});
