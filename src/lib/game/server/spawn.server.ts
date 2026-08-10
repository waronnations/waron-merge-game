/** Server-authoritative spawn + swap commit logic. */

import {
  BOARD_SIZE,
  SPAWN_ENERGY,
  MAX_TIER,
  NUKE_HIT_DISABLE_MS,
} from "@/lib/constants";
import { sql } from "@/lib/db.server";
import {
  type ServerGameState,
  loadProgress,
  writeProgress,
  ensureBoard,
  clampServerEnergy,
  isCorrectSide,
} from "./state.server";
import { pickSmartVariant, updateConquerFlags } from "../helpers";

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

/**
 * Same-side only + optional client placement.
 * If client sends targetIdx/faction and the cell is not free on the server,
 * return stale_placement (do NOT silent-remap — that causes unit "replacements").
 *
 * Includes:
 * - Smart variant selection (frequency-aware)
 * - Preference for the side closer to conquest
 * - Conquest Event flag update after spawn
 */
export async function serverCommitSpawn(
  userId: number,
  opts?: { targetIdx?: number; faction?: "dog" | "cat" },
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
  const board = ensureBoard(state);

  const energy = clampServerEnergy(state.energy, 0);
  if (energy < SPAWN_ENERGY) {
    return { ok: false, reason: "no_energy" };
  }

  const size = BOARD_SIZE * BOARD_SIZE;

  const dogEmpty: number[] = [];
  const catEmpty: number[] = [];
  for (let i = 0; i < size; i++) {
    if (board[i] !== null) continue;
    if (isCorrectSide(i, "dog")) dogEmpty.push(i);
    else catEmpty.push(i);
  }
  if (dogEmpty.length + catEmpty.length === 0) {
    return { ok: false, reason: "board_full" };
  }

  let target = -1;
  let faction: "dog" | "cat" = "dog";

  const clientWantsPlacement =
    typeof opts?.targetIdx === "number" &&
    Number.isInteger(opts.targetIdx) &&
    opts.targetIdx >= 0 &&
    opts.targetIdx < size &&
    (opts.faction === "dog" || opts.faction === "cat");

  if (clientWantsPlacement) {
    // Client already placed optimistically — must match server board or fail.
    if (
      board[opts!.targetIdx!] !== null ||
      !isCorrectSide(opts!.targetIdx!, opts!.faction!)
    ) {
      return { ok: false, reason: "stale_placement" };
    }
    target = opts!.targetIdx!;
    faction = opts!.faction!;
  } else {
    // Prefer the side already closer to conquest
    let dogHybridCount = 0;
    let catHybridCount = 0;
    for (let i = 0; i < size; i++) {
      const cell = board[i];
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

    if (preferDog) {
      if (dogEmpty.length > 0) {
        target = dogEmpty[Math.floor(Math.random() * dogEmpty.length)]!;
        faction = "dog";
      } else {
        target = catEmpty[Math.floor(Math.random() * catEmpty.length)]!;
        faction = "cat";
      }
    } else {
      if (catEmpty.length > 0) {
        target = catEmpty[Math.floor(Math.random() * catEmpty.length)]!;
        faction = "cat";
      } else {
        target = dogEmpty[Math.floor(Math.random() * dogEmpty.length)]!;
        faction = "dog";
      }
    }
  }

  const variant = pickSmartVariant(board, faction);

  board[target] = {
    id: state.nextId++,
    faction,
    tier: 1,
    variant,
  };

  state.energy = clampServerEnergy(energy - SPAWN_ENERGY, 0);
  state.board = board;
  state.lastRegenAt = Date.now();

  // Conquest Event check (full + no merges left → conquered flag)
  const updated = updateConquerFlags(state as any);
  Object.assign(state, {
    dogSideConquered: updated.dogSideConquered,
    catSideConquered: updated.catSideConquered,
  });

  await writeProgress(userId, state, { touchSyncClock: true });
  return { ok: true, state };
}

export async function serverCommitSwap(
  userId: number,
  from: number,
  to: number,
): Promise<
  | { ok: true; state: ServerGameState }
  | { ok: false; reason: string }
> {
  const size = BOARD_SIZE * BOARD_SIZE;
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= size ||
    to >= size ||
    from === to
  ) {
    return { ok: false, reason: "invalid_indices" };
  }

  if (await isNationNukedLocked(userId)) {
    return { ok: false, reason: "nuked_disabled" };
  }

  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  const state = { ...(prev.state as ServerGameState) };
  const board = ensureBoard(state);

  const a = board[from];
  const b = board[to];
  if (!a) return { ok: false, reason: "empty_from" };

  if (a.faction !== "hybrid" && !isCorrectSide(to, a.faction)) {
    return { ok: false, reason: "wrong_side" };
  }
  if (b && b.faction !== "hybrid" && !isCorrectSide(from, b.faction)) {
    return { ok: false, reason: "wrong_side" };
  }

  if (
    a.tier >= MAX_TIER &&
    a.faction !== "hybrid" &&
    !isCorrectSide(to, a.faction)
  ) {
    return { ok: false, reason: "wrong_side" };
  }
  if (
    b &&
    b.tier >= MAX_TIER &&
    b.faction !== "hybrid" &&
    !isCorrectSide(from, b.faction)
  ) {
    return { ok: false, reason: "wrong_side" };
  }

  board[from] = b;
  board[to] = a;
  state.board = board;

  await writeProgress(userId, state, { touchSyncClock: true });
  return { ok: true, state };
}
