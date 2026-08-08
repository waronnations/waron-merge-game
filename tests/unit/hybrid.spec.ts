import { describe, it, expect } from "vitest";
import {
  resolveHybridState,
  sacrificeBoardHybridState,
} from "@/lib/game/hybrid";
import { initialState } from "@/lib/game/helpers";
import {
  HYBRID_SACRIFICE_GLORY,
  HYBRID_SACRIFICE_WARDOG,
  HYBRID_SACRIFICE_WARCAT,
  HYBRID_KEEP_GLORY,
  HYBRID_TIER,
} from "@/lib/constants";
import type { GameState } from "@/lib/game/types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...initialState(), board: Array(36).fill(null), ...overrides };
}

describe("resolveHybridState", () => {
  it("returns state unchanged when there is no pending hybrid", () => {
    const s = baseState();
    expect(resolveHybridState(s, "keep")).toBe(s);
  });

  it("sacrifice grants glory + tokens and clears pendingHybrid", () => {
    const s = baseState({
      pendingHybrid: { id: 5, parentDogId: 1, parentCatId: 2, from: 0, to: 1 },
    });
    const next = resolveHybridState(s, "sacrifice");
    expect(next.pendingHybrid).toBeNull();
    expect(next.glory).toBe(s.glory + HYBRID_SACRIFICE_GLORY);
    expect(next.wardogTokens).toBe(s.wardogTokens + HYBRID_SACRIFICE_WARDOG);
    expect(next.warcatTokens).toBe(s.warcatTokens + HYBRID_SACRIFICE_WARCAT);
  });

  it("keep places a hybrid unit on the board", () => {
    const s = baseState({
      pendingHybrid: { id: 5, parentDogId: 1, parentCatId: 2, from: 0, to: 1 },
    });
    const next = resolveHybridState(s, "keep");
    expect(next.pendingHybrid).toBeNull();
    expect(next.board[1]).toMatchObject({ id: 5, faction: "hybrid", tier: HYBRID_TIER });
    expect(next.glory).toBe(s.glory + HYBRID_KEEP_GLORY);
  });
});

describe("sacrificeBoardHybridState", () => {
  it("fails for invalid index", () => {
    const s = baseState();
    const out = sacrificeBoardHybridState(s, -1);
    expect(out.ok).toBe(false);
  });

  it("fails when cell is not a hybrid", () => {
    const s = baseState();
    s.board[0] = { id: 1, faction: "dog", tier: 1 };
    const out = sacrificeBoardHybridState(s, 0);
    expect(out.ok).toBe(false);
  });

  it("sacrifices a hybrid cell for rewards", () => {
    const s = baseState();
    s.board[0] = { id: 1, faction: "hybrid", tier: HYBRID_TIER, isHybrid: true };
    const out = sacrificeBoardHybridState(s, 0);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.nextState.board[0]).toBeNull();
      expect(out.glory).toBe(HYBRID_SACRIFICE_GLORY);
    }
  });
});
