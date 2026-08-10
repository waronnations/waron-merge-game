// src/lib/game/hybrid.ts
// Pure hybrid resolve / sacrifice / conquer logic
import type { GameState, HybridNFT } from "./types";
import {
  HYBRID_SACRIFICE_GLORY,
  HYBRID_SACRIFICE_WARDOG,
  HYBRID_SACRIFICE_WARCAT,
  HYBRID_KEEP_GLORY,
  HYBRID_ART_BONUS_GLORY,
  HYBRID_ART_BONUS_TOKENS,
  HYBRID_IMAGE_PROMPT_TEMPLATE,
  HYBRID_TIER,
  BOARD_SIZE,
} from "@/lib/constants";
import { updateConquerFlags } from "./helpers";

/** Resolves a pending hybrid clash (sacrifice for rewards, or keep as unit). */
export function resolveHybridState(
  s: GameState,
  choice: "sacrifice" | "keep",
): GameState {
  if (!s.pendingHybrid) return s;

  const { id, parentDogId, parentCatId, to } = s.pendingHybrid;
  const board = s.board.slice();

  if (choice === "sacrifice") {
    const next = {
      ...s,
      board,
      pendingHybrid: null,
      glory: s.glory + HYBRID_SACRIFICE_GLORY,
      wardogTokens: s.wardogTokens + HYBRID_SACRIFICE_WARDOG,
      warcatTokens: s.warcatTokens + HYBRID_SACRIFICE_WARCAT,
      highestTier: Math.max(s.highestTier, HYBRID_TIER),
      lastSeenAt: Date.now(),
    };
    return updateConquerFlags(next);
  }

  // Keep on board (on the target side = opponent side of the merge)
  board[to] = {
    id,
    faction: "hybrid",
    tier: HYBRID_TIER,
    isHybrid: true,
    parentDogId,
    parentCatId,
  };

  const next = {
    ...s,
    board,
    pendingHybrid: null,
    glory: s.glory + HYBRID_KEEP_GLORY,
    highestTier: Math.max(s.highestTier, HYBRID_TIER),
    lastSeenAt: Date.now(),
  };

  return updateConquerFlags(next);
}

/** Finalizes a pending hybrid with AI-generated art. */
export function completeHybridWithArtState(
  s: GameState,
  imageUrl: string,
): GameState {
  if (!s.pendingHybrid) return s;

  const { id, parentDogId, parentCatId, to } = s.pendingHybrid;
  const board = s.board.slice();

  const seed = `HYB-${id}-${parentDogId}-${parentCatId}-${Date.now().toString(36)}`;
  const imagePrompt = HYBRID_IMAGE_PROMPT_TEMPLATE(seed);

  const newHybrid: HybridNFT = {
    id,
    seed,
    parentDogId,
    parentCatId,
    createdAt: Date.now(),
    minted: true,
    imagePrompt,
    imageUrl,
  };

  board[to] = {
    id,
    faction: "hybrid",
    tier: HYBRID_TIER,
    isHybrid: true,
    parentDogId,
    parentCatId,
    seed,
    imageUrl,
  };

  const next = {
    ...s,
    board,
    pendingHybrid: null,
    hybrids: [...(s.hybrids || []), newHybrid],
    glory: s.glory + HYBRID_ART_BONUS_GLORY,
    wardogTokens: s.wardogTokens + HYBRID_ART_BONUS_TOKENS,
    warcatTokens: s.warcatTokens + HYBRID_ART_BONUS_TOKENS,
    highestTier: Math.max(s.highestTier, HYBRID_TIER),
    lastSeenAt: Date.now(),
  };

  return updateConquerFlags(next);
}

export type SacrificeBoardHybridOutcome =
  | {
      ok: true;
      nextState: GameState;
      glory: number;
      wardog: number;
      warcat: number;
    }
  | { ok: false; reason: string };

/** Sacrifice a single hybrid already on the board. */
export function sacrificeBoardHybridState(
  s: GameState,
  idx: number,
): SacrificeBoardHybridOutcome {
  if (idx < 0 || idx >= s.board.length) {
    return { ok: false, reason: "invalid_index" };
  }
  const cell = s.board[idx];
  if (!cell || cell.faction !== "hybrid") {
    return { ok: false, reason: "not_hybrid" };
  }

  const board = s.board.slice();
  board[idx] = null;

  const glory = HYBRID_SACRIFICE_GLORY;
  const wardog = HYBRID_SACRIFICE_WARDOG;
  const warcat = HYBRID_SACRIFICE_WARCAT;

  let nextState: GameState = {
    ...s,
    board,
    glory: s.glory + glory,
    wardogTokens: s.wardogTokens + wardog,
    warcatTokens: s.warcatTokens + warcat,
    lastSeenAt: Date.now(),
  };

  nextState = updateConquerFlags(nextState);

  return { ok: true, nextState, glory, wardog, warcat };
}

/**
 * Mass-sacrifice every hybrid on a conquered side.
 * Gives 1.5× bonus when the side is actually conquered.
 */
export function sacrificeConqueredSideState(
  s: GameState,
  side: "dog" | "cat",
): SacrificeBoardHybridOutcome {
  const isConquered = side === "dog" ? s.dogSideConquered : s.catSideConquered;
  if (!isConquered) {
    return { ok: false, reason: "side_not_conquered" };
  }

  const board = s.board.slice();
  let count = 0;
  const startCol = side === "dog" ? 0 : 3;
  const endCol = side === "dog" ? 3 : BOARD_SIZE;

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = startCol; col < endCol; col++) {
      const idx = row * BOARD_SIZE + col;
      const cell = board[idx];
      if (cell && cell.faction === "hybrid") {
        board[idx] = null;
        count++;
      }
    }
  }

  if (count === 0) {
    return { ok: false, reason: "no_hybrids" };
  }

  // Base reward × count + 50% conquest bonus
  const mult = 1.5;
  const glory = Math.round(HYBRID_SACRIFICE_GLORY * count * mult);
  const wardog = +(HYBRID_SACRIFICE_WARDOG * count * mult).toFixed(2);
  const warcat = +(HYBRID_SACRIFICE_WARCAT * count * mult).toFixed(2);

  let nextState: GameState = {
    ...s,
    board,
    glory: s.glory + glory,
    wardogTokens: s.wardogTokens + wardog,
    warcatTokens: s.warcatTokens + warcat,
    lastSeenAt: Date.now(),
  };

  nextState = updateConquerFlags(nextState);

  return { ok: true, nextState, glory, wardog, warcat };
}
