import { describe, it, expect } from "vitest";
import { computeSpawn, computeRollbackSpawn } from "@/lib/game/spawn";
import {
  initialState,
  pickSmartVariant,
} from "@/lib/game/helpers";
import { SPAWN_ENERGY, MAX_ENERGY, BOARD_SIZE } from "@/lib/constants";
import type { GameState, Cell } from "@/lib/game/types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialState(),
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null),
    ...overrides,
  };
}

describe("pickSmartVariant", () => {
  it("returns pure random (0-2) when side is empty", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    const v = pickSmartVariant(board, "dog");
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(2);
  });

  it("prefers an existing tier-1 variant", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    board[0] = { id: 1, faction: "dog", tier: 1, variant: 2 };
    board[1] = { id: 2, faction: "dog", tier: 1, variant: 2 };

    // Run many times – should heavily prefer 2
    const counts = [0, 0, 0];
    for (let i = 0; i < 50; i++) {
      counts[pickSmartVariant(board, "dog")]++;
    }
    expect(counts[2]).toBeGreaterThan(30);
  });

  it("falls back to any existing variant when no tier-1 remains", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    board[0] = { id: 1, faction: "dog", tier: 4, variant: 1 };
    board[6] = { id: 2, faction: "dog", tier: 3, variant: 1 };

    const v = pickSmartVariant(board, "dog");
    expect(v).toBe(1);
  });

  it("ignores hybrids and opposite faction", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    // hybrid on dog side
    board[0] = { id: 1, faction: "hybrid", tier: 6, variant: 0 };
    // cat on dog side (should be ignored by side logic, but we still check faction)
    board[1] = { id: 2, faction: "cat", tier: 1, variant: 0 };
    // real dog tier-1 of variant 2
    board[2] = { id: 3, faction: "dog", tier: 1, variant: 2 };

    const counts = [0, 0, 0];
    for (let i = 0; i < 40; i++) {
      counts[pickSmartVariant(board, "dog")]++;
    }
    expect(counts[2]).toBeGreaterThan(25);
  });
});

describe("computeSpawn", () => {
  it("fails when not enough energy", () => {
    const s = baseState({ energy: SPAWN_ENERGY - 1 });
    const out = computeSpawn(s);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("Not enough energy");
  });

  it("fails when board is completely full", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill({
      id: 1,
      faction: "dog",
      tier: 1,
      variant: 0,
    });
    const s = baseState({ energy: MAX_ENERGY, board });
    const out = computeSpawn(s);
    expect(out.ok).toBe(false);
  });

  it("spawns a unit on an empty cell, deducts energy, and sets a valid variant", () => {
    const s = baseState({ energy: MAX_ENERGY });
    const out = computeSpawn(s);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.nextState.energy).toBe(MAX_ENERGY - SPAWN_ENERGY);
      const cell = out.nextState.board[out.targetIdx] as Cell;
      expect(cell).toMatchObject({
        faction: out.faction,
        tier: 1,
      });
      expect(cell.variant).toBeGreaterThanOrEqual(0);
      expect(cell.variant).toBeLessThanOrEqual(2);
      expect(out.unitId).toBe(s.nextId);
    }
  });

  it("falls back to the other side when preferred side is full", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const col = i % BOARD_SIZE;
      if (col < 3) {
        board[i] = { id: i + 1, faction: "dog", tier: 1, variant: 0 };
      }
    }
    const s = baseState({ energy: MAX_ENERGY, board });
    const out = computeSpawn(s);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.faction).toBe("cat");
    }
  });

  it("smart variant: strongly prefers existing tier-1 on the target side", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    // Place several tier-1 dogs of variant 2
    board[0] = { id: 10, faction: "dog", tier: 1, variant: 2 };
    board[1] = { id: 11, faction: "dog", tier: 1, variant: 2 };
    board[6] = { id: 12, faction: "dog", tier: 1, variant: 2 };

    const s = baseState({ energy: MAX_ENERGY, board });

    let matched = 0;
    let dogSpawns = 0;
    for (let i = 0; i < 40; i++) {
      const out = computeSpawn(s);
      if (out.ok && out.faction === "dog") {
        dogSpawns++;
        const cell = out.nextState.board[out.targetIdx] as Cell;
        if (cell.variant === 2) matched++;
      }
    }
    // Should almost always pick variant 2 when spawning on dog side
    expect(dogSpawns).toBeGreaterThan(5);
    expect(matched / dogSpawns).toBeGreaterThan(0.7);
  });

  it("smart variant: uses existing high-tier variant when no tier-1 left", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    board[0] = { id: 10, faction: "dog", tier: 4, variant: 1 };
    board[1] = { id: 11, faction: "dog", tier: 3, variant: 1 };

    const s = baseState({ energy: MAX_ENERGY, board });
    const out = computeSpawn(s);
    expect(out.ok).toBe(true);
    if (out.ok && out.faction === "dog") {
      const cell = out.nextState.board[out.targetIdx] as Cell;
      expect(cell.variant).toBe(1);
    }
  });
});

describe("computeRollbackSpawn", () => {
  it("removes the spawned unit and refunds energy", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    board[0] = { id: 42, faction: "dog", tier: 1, variant: 0 };
    const s = baseState({ energy: 10, board });
    const next = computeRollbackSpawn(s, 0, 42);
    expect(next.board[0]).toBeNull();
    expect(next.energy).toBe(10 + SPAWN_ENERGY);
  });

  it("no-ops if the unit id does not match", () => {
    const board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    board[0] = { id: 42, faction: "dog", tier: 1, variant: 0 };
    const s = baseState({ energy: 10, board });
    const next = computeRollbackSpawn(s, 0, 999);
    expect(next).toBe(s);
  });
});
