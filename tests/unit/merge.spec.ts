import { describe, it, expect } from "vitest";
import { computeHybridClash, computeNormalMerge } from "@/lib/game/merge";
import { initialState } from "@/lib/game/helpers";
import type { GameState } from "@/lib/game/types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  const s = initialState();
  return { ...s, board: Array(36).fill(null), ...overrides };
}

describe("computeNormalMerge", () => {
  it("returns null when cells missing", () => {
    const s = baseState();
    expect(computeNormalMerge(s, 0, 1, 1, 1)).toBeNull();
  });

  it("merges two identical tier-1 dogs on the correct side", () => {
    const s = baseState();
    s.board[0] = { id: 1, faction: "dog", tier: 1, variant: 0 };
    s.board[1] = { id: 2, faction: "dog", tier: 1, variant: 0 };
    const out = computeNormalMerge(s, 0, 1, 1, 1);
    expect(out).not.toBeNull();
    expect(out!.nextState.board[0]).toBeNull();
    expect(out!.nextState.board[1]).toMatchObject({ faction: "dog", tier: 2 });
    expect(out!.nextState.totalMerges).toBe(1);
    expect(out!.result.ok).toBe(true);
  });

  it("refuses merge across different factions", () => {
    const s = baseState();
    s.board[0] = { id: 1, faction: "dog", tier: 1, variant: 0 };
    s.board[4] = { id: 2, faction: "cat", tier: 1, variant: 0 };
    expect(computeNormalMerge(s, 0, 4, 1, 1)).toBeNull();
  });

  it("refuses merge of different variants", () => {
    const s = baseState();
    s.board[0] = { id: 1, faction: "dog", tier: 1, variant: 0 };
    s.board[1] = { id: 2, faction: "dog", tier: 1, variant: 1 };
    expect(computeNormalMerge(s, 0, 1, 1, 1)).toBeNull();
  });

  it("refuses merge when a unit is already at MAX_TIER", () => {
    const s = baseState();
    s.board[0] = { id: 1, faction: "dog", tier: 5, variant: 0 };
    s.board[1] = { id: 2, faction: "dog", tier: 5, variant: 0 };
    expect(computeNormalMerge(s, 0, 1, 1, 1)).toBeNull();
  });

  it("refuses merge when a cell sits on the wrong side", () => {
    const s = baseState();
    // index 0 = col 0 (dog side), index 3 = col 3 (cat side) — placing dogs on cat side
    s.board[3] = { id: 1, faction: "dog", tier: 1, variant: 0 };
    s.board[4] = { id: 2, faction: "dog", tier: 1, variant: 0 };
    expect(computeNormalMerge(s, 3, 4, 1, 1)).toBeNull();
  });
});

describe("computeHybridClash", () => {
  it("returns null unless both units are MAX_TIER and opposite factions", () => {
    const s = baseState();
    s.board[0] = { id: 1, faction: "dog", tier: 5, variant: 0 };
    s.board[1] = { id: 2, faction: "dog", tier: 5, variant: 0 };
    expect(computeHybridClash(s, 0, 1, 1)).toBeNull();
  });

  it("produces a hybrid clash outcome for two MAX_TIER opposite units", () => {
    const s = baseState();
    s.board[0] = { id: 1, faction: "dog", tier: 5, variant: 0 };
    s.board[1] = { id: 2, faction: "cat", tier: 5, variant: 0 };
    const out = computeHybridClash(s, 0, 1, 1);
    expect(out).not.toBeNull();
    expect(out!.nextState.board[0]).toBeNull();
    expect(out!.nextState.board[1]).toBeNull();
    expect(out!.dogId).toBe(1);
    expect(out!.catId).toBe(2);
    expect(out!.result.isHybrid).toBe(true);
  });
});
