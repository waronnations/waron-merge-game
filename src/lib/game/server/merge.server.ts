/** Server-authoritative merge commit logic (tile merges + hybrid trigger + Live Targets). */

import {
  BOARD_SIZE,
  MAX_TIER,
  ENERGY_PER_MERGE,
  TOKENS_PER_MERGE,
  NUKE_HIT_DISABLE_MS,
} from "@/lib/constants";
import { addTokens } from "@/lib/tokens";
import { sql } from "@/lib/db.server";
import {
  type ServerGameState,
  loadProgress,
  writeProgress,
  ensureBoard,
  clampServerEnergy,
  isCorrectSide,
  gloryForTier,
} from "./state.server";

function cellVariant(cell: { id: number; variant?: number }): number {
  if (typeof cell.variant === "number" && Number.isFinite(cell.variant)) {
    return Math.abs(Math.floor(cell.variant)) % 3;
  }
  return Math.abs(cell.id) % 3;
}

/** dog → only cat side, cat → only dog side, hybrid → either */
function canAttackIndex(
  attackerFaction: string,
  targetIdx: number,
): boolean {
  if (attackerFaction === "hybrid") return true;
  const targetIsDogSide = isCorrectSide(targetIdx, "dog");
  if (attackerFaction === "dog") return !targetIsDogSide;
  if (attackerFaction === "cat") return targetIsDogSide;
  return false;
}

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

export async function serverCommitMerge(
  userId: number,
  from: number,
  to: number,
): Promise<
  | {
      ok: true;
      state: ServerGameState;
      isHybrid?: boolean;
      token?: string;
      amount?: number;
    }
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

  const serverUnits = board.filter(Boolean).length;
  if (serverUnits === 0) {
    return { ok: false, reason: "board_not_seeded" };
  }

  const a = board[from];
  const b = board[to];
  if (!a || !b) return { ok: false, reason: "empty_cell" };

  const energyNow = clampServerEnergy(state.energy, 0);
  if (energyNow < ENERGY_PER_MERGE) {
    return { ok: false, reason: "no_energy" };
  }

  // ── LIVE TARGET ATTACK (War Mode) – SERVER AUTHORITATIVE ────────────
  if ((b as any).isTarget && a.faction !== "target") {
    // STRICT RULE: only adversary side
    if (!canAttackIndex(a.faction, to)) {
      return {
        ok: false,
        reason:
          a.faction === "dog"
            ? "wardog_can_only_attack_warcat_side"
            : a.faction === "cat"
              ? "warcat_can_only_attack_wardog_side"
              : "wrong_side",
      };
    }

    const isNation = (b as any).targetType === "nation";
    // Nation targets require T5 or hybrid
    if (isNation && a.tier < MAX_TIER && a.faction !== "hybrid") {
      return { ok: false, reason: "invalid_merge" };
    }

    board[from] = null;
    board[to] = null;
    state.energy = clampServerEnergy(energyNow - ENERGY_PER_MERGE, 0);
    state.totalMerges = Number(state.totalMerges) + 1;

    const gloryGain = isNation ? 480 : 320;
    state.glory = Number(state.glory) + gloryGain;

    // Optional: push front line if warMode exists on state
    if ((state as any).warMode?.active) {
      const wm = (state as any).warMode;
      const attackedDogSide = isCorrectSide(to, "dog");
      const control = isNation ? 12 : 8;
      const push = attackedDogSide ? -control : control;
      wm.frontLine = Math.max(0, Math.min(100, (wm.frontLine ?? 50) + push));
      wm.controlGenerated = (wm.controlGenerated ?? 0) + control;
      // remove the target from the list
      if (Array.isArray(wm.targets)) {
        wm.targets = wm.targets.filter(
          (t: any) => t.id !== (b as any).targetId,
        );
      }
      (state as any).warMode = wm;
    }

    state.board = board;
    await writeProgress(userId, state, {
      touchSyncClock: true,
      gloryDelta: gloryGain,
    });
    return { ok: true, state };
  }

  // Classic Hybrid Clash (T5 dog + T5 cat)
  const isMax = a.tier >= MAX_TIER && b.tier >= MAX_TIER;
  const opposing =
    a.faction !== b.faction &&
    a.faction !== "hybrid" &&
    b.faction !== "hybrid";

  if (isMax && opposing) {
    board[from] = null;
    board[to] = null;
    state.energy = clampServerEnergy(energyNow - ENERGY_PER_MERGE, 0);

    state.totalMerges = Number(state.totalMerges) + 1;
    state.pendingHybrid = {
      id: state.nextId++,
      parentDogId: a.faction === "dog" ? a.id : b.id,
      parentCatId: a.faction === "cat" ? a.id : b.id,
      from,
      to,
    };
    state.explosion = { idx: to, color: "magenta", key: Date.now() };
    state.board = board;
    await writeProgress(userId, state, { touchSyncClock: true, gloryDelta: 0 });
    return { ok: true, state, isHybrid: true };
  }

  // Normal same-faction merge (own side only – already correct)
  if (a.faction !== b.faction || a.tier !== b.tier || a.tier >= MAX_TIER) {
    return { ok: false, reason: "invalid_merge" };
  }

  const va = cellVariant(a as { id: number; variant?: number });
  const vb = cellVariant(b as { id: number; variant?: number });
  if (va !== vb) {
    return { ok: false, reason: "invalid_merge" };
  }

  if (!isCorrectSide(to, a.faction)) {
    return { ok: false, reason: "wrong_side" };
  }

  const newTier = a.tier + 1;
  const newId = state.nextId++;
  board[from] = null;
  board[to] = {
    id: newId,
    faction: a.faction,
    tier: newTier,
    variant: va,
  } as (typeof board)[number];

  state.energy = clampServerEnergy(energyNow - ENERGY_PER_MERGE, 0);
  state.totalMerges = Number(state.totalMerges) + 1;
  state.highestTier = Math.max(Number(state.highestTier), newTier);

  let gloryGain = gloryForTier(newTier);
  if (state.gloryBoostUntil && Date.now() < Number(state.gloryBoostUntil)) {
    gloryGain *= 2;
  }
  state.glory = Number(state.glory) + gloryGain;

  const tokenType = state.totalMerges % 2 === 0 ? "wardog" : "warcat";
  if (tokenType === "wardog") {
    state.wardogTokens = addTokens(state.wardogTokens, TOKENS_PER_MERGE);
  } else {
    state.warcatTokens = addTokens(state.warcatTokens, TOKENS_PER_MERGE);
  }

  state.board = board;
  await writeProgress(userId, state, {
    touchSyncClock: true,
    gloryDelta: gloryGain,
  });
  return {
    ok: true,
    state,
    token: tokenType,
    amount: TOKENS_PER_MERGE,
  };
}
