import { describe, it, expect } from "vitest";
import { applyServerStateLogic, applyServerEconomyLogic, hydrateState } from "@/lib/game/server-reconcile";
import { initialState } from "@/lib/game/helpers";
import { STARTER_PACK } from "@/lib/constants";
import type { GameState } from "@/lib/game/types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...initialState(), board: Array(36).fill(null), ...overrides };
}

describe("applyServerStateLogic", () => {
  it("prefers local board when local unit count is higher", () => {
    const local = baseState({ totalMerges: 5 });
    local.board[0] = { id: 1, faction: "dog", tier: 1 };
    const incoming = baseState({ totalMerges: 5 });
    const { preferLocalBoard, next } = applyServerStateLogic(local, incoming, {
      boardRevision: 0,
      localBoardLockUntil: 0,
    });
    expect(preferLocalBoard).toBe(true);
    expect(next.board[0]).toMatchObject({ faction: "dog" });
  });

  it("takes server board when server has more merges and more units", () => {
    const local = baseState({ totalMerges: 1 });
    const incoming = baseState({ totalMerges: 10 });
    incoming.board[0] = { id: 9, faction: "cat", tier: 1 };
    const { preferLocalBoard, next } = applyServerStateLogic(local, incoming, {
      boardRevision: 0,
      localBoardLockUntil: 0,
    });
    expect(preferLocalBoard).toBe(false);
    expect(next.board[0]).toMatchObject({ id: 9 });
  });

  it("respects the local board lock window", () => {
    const local = baseState();
    const incoming = baseState({ totalMerges: 100 });
    const { preferLocalBoard } = applyServerStateLogic(local, incoming, {
      boardRevision: 0,
      localBoardLockUntil: Date.now() + 10_000,
    });
    expect(preferLocalBoard).toBe(true);
  });

  it("takes max of glory/merges/highestTier between local and incoming", () => {
    const local = baseState({ glory: 500, totalMerges: 20, highestTier: 3 });
    const incoming = baseState({ glory: 100, totalMerges: 5, highestTier: 5 });
    const { next } = applyServerStateLogic(local, incoming, {
      boardRevision: 0,
      localBoardLockUntil: 0,
    });
    expect(next.glory).toBe(500);
    expect(next.highestTier).toBe(5);
  });

  it("falls back to STARTER_PACK.energy when incoming energy is not finite", () => {
    const local = baseState({ energy: 10 });
    const incoming = baseState({ totalMerges: 100, energy: NaN as unknown as number });
    const { next } = applyServerStateLogic(local, incoming, {
      boardRevision: 0,
      localBoardLockUntil: 0,
    });
    expect(next.energy).toBe(STARTER_PACK.energy);
  });
});

describe("applyServerEconomyLogic", () => {
  it("does not touch the board unless incoming.board is provided", () => {
    const s = baseState();
    s.board[0] = { id: 1, faction: "dog", tier: 1 };
    const { next, boardChanged } = applyServerEconomyLogic(s, { glory: 50 });
    expect(boardChanged).toBe(false);
    expect(next.board[0]).toMatchObject({ faction: "dog" });
    expect(next.glory).toBe(Math.max(s.glory, 50));
  });

  it("updates energy and tokens when provided", () => {
    const s = baseState({ energy: 10, wardogTokens: 1, warcatTokens: 1 });
    const { next } = applyServerEconomyLogic(s, { energy: 40, wardogTokens: 5 });
    expect(next.energy).toBe(40);
    expect(next.wardogTokens).toBe(5);
    expect(next.warcatTokens).toBe(1);
  });
});

describe("hydrateState", () => {
  it("sanitizes provided board and clamps energy", () => {
    const s = baseState();
    const next = hydrateState(s, { energy: 99999, board: [] });
    expect(next.energy).toBe(100);
    expect(next.board.length).toBe(36);
  });
});
