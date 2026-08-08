/** Server-authoritative hybrid resolution (sacrifice/keep + AI art + board sacrifice). */

import { addTokens } from "@/lib/tokens";
import { sql } from "@/lib/db.server";
import { NUKE_HIT_DISABLE_MS } from "@/lib/constants";
import {
  type ServerGameState,
  loadProgress,
  writeProgress,
  ensureBoard,
} from "./state.server";

/** Returns true if the user's nation was hit less than NUKE_HIT_DISABLE_MS ago */
async function isNationNukedLocked(userId: number): Promise<boolean> {
  const mem = await sql`
    SELECT n.last_nuke_received_at
    FROM nation_members nm
    JOIN nations n ON n.id = nm.nation_id
    WHERE nm.user_id = ${userId}
    LIMIT 1
  `;
  const row = mem.rows[0];
  if (!row?.last_nuke_received_at) return false;
  const receivedAt = new Date(row.last_nuke_received_at as string).getTime();
  return Date.now() - receivedAt < NUKE_HIT_DISABLE_MS;
}

export async function serverResolveHybrid(
  userId: number,
  choice: "sacrifice" | "keep",
): Promise<
  | { ok: true; state: ServerGameState }
  | { ok: false; reason: string }
> {
  if (await isNationNukedLocked(userId)) {
    return { ok: false, reason: "nuked_disabled" };
  }

  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  const state = { ...(prev.state as ServerGameState) };
  if (!state.pendingHybrid) return { ok: false, reason: "no_pending_hybrid" };

  const board = ensureBoard(state);
  const pending = state.pendingHybrid as {
    id: number;
    parentDogId: number;
    parentCatId: number;
    to: number;
  };

  if (choice === "sacrifice") {
    state.glory = Number(state.glory) + 2800;
    state.wardogTokens = addTokens(state.wardogTokens, 3.0);
    state.warcatTokens = addTokens(state.warcatTokens, 3.0);
    state.highestTier = Math.max(Number(state.highestTier), 6);
  } else {
    board[pending.to] = {
      id: pending.id,
      faction: "hybrid",
      tier: 6,
      isHybrid: true,
      parentDogId: pending.parentDogId,
      parentCatId: pending.parentCatId,
    };
    state.highestTier = Math.max(Number(state.highestTier), 6);
  }

  state.pendingHybrid = null;
  state.explosion = null;
  state.board = board;

  await writeProgress(userId, state, {
    touchSyncClock: true,
    gloryDelta: choice === "sacrifice" ? 2800 : 0,
  });
  return { ok: true, state };
}

export async function serverCompleteHybridWithArt(
  userId: number,
  imageUrl: string,
): Promise<
  | { ok: true; state: ServerGameState }
  | { ok: false; reason: string }
> {
  if (await isNationNukedLocked(userId)) {
    return { ok: false, reason: "nuked_disabled" };
  }

  const url = String(imageUrl || "").trim();
  if (
    !url.startsWith("https://") ||
    url.length < 12 ||
    url.length > 2048 ||
    /[\s<>"']/.test(url)
  ) {
    return { ok: false, reason: "invalid_image_url" };
  }

  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  const state = { ...(prev.state as ServerGameState) };
  if (!state.pendingHybrid) return { ok: false, reason: "no_pending_hybrid" };

  const board = ensureBoard(state);
  const pending = state.pendingHybrid as {
    id: number;
    parentDogId: number;
    parentCatId: number;
    to: number;
  };

  const seed = `HYB-${pending.id}-${pending.parentDogId}-${pending.parentCatId}`;
  const imagePrompt = `Epic cinematic hybrid warrior, fusion of fierce war dog and elegant war cat, armored, glowing energy aura, red and purple neon lights, dramatic battlefield lighting, highly detailed, 4k, seed ${seed}`;

  const hybridEntry = {
    id: pending.id,
    seed,
    parentDogId: pending.parentDogId,
    parentCatId: pending.parentCatId,
    createdAt: Date.now(),
    minted: true,
    imagePrompt,
    imageUrl: url,
  };

  board[pending.to] = {
    id: pending.id,
    faction: "hybrid",
    tier: 6,
    isHybrid: true,
    parentDogId: pending.parentDogId,
    parentCatId: pending.parentCatId,
    seed,
    imageUrl: url,
  };

  const hybrids = Array.isArray(state.hybrids) ? [...state.hybrids] : [];
  hybrids.push(hybridEntry);
  if (hybrids.length > 50) hybrids.splice(0, hybrids.length - 50);

  state.board = board;
  state.hybrids = hybrids;
  state.pendingHybrid = null;
  state.explosion = null;
  state.highestTier = Math.max(Number(state.highestTier), 6);

  await writeProgress(userId, state, { touchSyncClock: true, gloryDelta: 0 });
  return { ok: true, state };
}

/**
 * Sacrifice a hybrid already sitting on the board (not pendingHybrid).
 * This MUST be a dedicated server commit — forceSync cannot clear the board
 * when totalMerges does not increase (board lock in syncProgress).
 */
export async function serverSacrificeBoardHybrid(
  userId: number,
  idx: number,
): Promise<
  | {
      ok: true;
      state: ServerGameState;
      glory: number;
      wardog: number;
      warcat: number;
    }
  | { ok: false; reason: string }
> {
  if (await isNationNukedLocked(userId)) {
    return { ok: false, reason: "nuked_disabled" };
  }

  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  const state = { ...(prev.state as ServerGameState) };
  const board = ensureBoard(state);

  if (!Number.isInteger(idx) || idx < 0 || idx >= board.length) {
    return { ok: false, reason: "invalid_index" };
  }

  const cell = board[idx] as
    | { faction?: string; isHybrid?: boolean }
    | null
    | undefined;
  if (
    !cell ||
    (cell.faction !== "hybrid" && cell.isHybrid !== true)
  ) {
    return { ok: false, reason: "not_hybrid" };
  }

  board[idx] = null;

  const glory = 2800;
  const wardog = 3.0;
  const warcat = 3.0;

  state.board = board;
  state.glory = Number(state.glory) + glory;
  state.wardogTokens = addTokens(state.wardogTokens, wardog);
  state.warcatTokens = addTokens(state.warcatTokens, warcat);
  state.explosion = null;

  await writeProgress(userId, state, {
    touchSyncClock: true,
    gloryDelta: glory,
  });

  return { ok: true, state, glory, wardog, warcat };
}
