// src/lib/game/hybrid.ts
// Pure hybrid resolve/sacrifice logic extracted from the useGame hook.
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
} from "@/lib/constants";

/** Resolves a pending hybrid clash (sacrifice for rewards, or keep as unit). */
export function resolveHybridState(
  s: GameState,
  choice: "sacrifice" | "keep",
): GameState {
  if (!s.pendingHybrid) return s;

  const { id, parentDogId, parentCatId, to } = s.pendingHybrid;
  const board = s.board.slice();

  if (choice === "sacrifice") {
    return {
      ...s,
      board,
      pendingHybrid: null,
      glory: s.glory + HYBRID_SACRIFICE_GLORY,
      wardogTokens: s.wardogTokens + HYBRID_SACRIFICE_WARDOG,
      warcatTokens: s.warcatTokens + HYBRID_SACRIFICE_WARCAT,
      highestTier: Math.max(s.highestTier, HYBRID_TIER),
      lastSeenAt: Date.now(),
    };
  }

  // Keep on board
  board[to] = {
    id,
    faction: "hybrid",
    tier: HYBRID_TIER,
    isHybrid: true,
    parentDogId,
    parentCatId,
  };

  return {
    ...s,
    board,
    pendingHybrid: null,
    glory: s.glory + HYBRID_KEEP_GLORY,
    highestTier: Math.max(s.highestTier, HYBRID_TIER),
    lastSeenAt: Date.now(),
  };
}

/** Finalizes a pending hybrid with AI-generated art, adding it to the NFT list. */
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

  return {
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

/** Sacrifice a hybrid already sitting on the board (AI art or procedural). */
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

  const nextState: GameState = {
    ...s,
    board,
    glory: s.glory + glory,
    wardogTokens: s.wardogTokens + wardog,
    warcatTokens: s.warcatTokens + warcat,
    lastSeenAt: Date.now(),
  };

  return { ok: true, nextState, glory, wardog, warcat };
}
