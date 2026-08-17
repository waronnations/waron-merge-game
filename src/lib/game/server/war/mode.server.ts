/** Server-authoritative War Mode deploy / attack */

import {
  BOARD_SIZE,
  ENERGY_PER_MERGE,
  NUKE_HIT_DISABLE_MS,
} from "@/lib/constants";
import { DEPLOY_ENERGY_COST, DEPLOY_COOLDOWN_MS, FRONT_LINE_MAX } from "@/lib/constants/war-mode";
import { sql } from "@/lib/db.server";
import {
  type ServerGameState,
  loadProgress,
  writeProgress,
  ensureBoard,
  clampServerEnergy,
  isCorrectSide,
} from "./state.server";

function canAttackIndex(attackerFaction: string, targetIdx: number): boolean {
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

/**
 * Server deploy / Live Target attack.
 * index = cell to deploy on OR the Live Target cell to strike.
 */
export async function serverCommitDeploy(
  userId: number,
  index: number,
): Promise<
  | { ok: true; state: ServerGameState; rewardText?: string }
  | { ok: false; reason: string }
> {
  const size = BOARD_SIZE * BOARD_SIZE;
  if (!Number.isInteger(index) || index < 0 || index >= size) {
    return { ok: false, reason: "invalid_index" };
  }

  if (await isNationNukedLocked(userId)) {
    return { ok: false, reason: "nuked_disabled" };
  }

  const prev = await loadProgress(userId);
  if (!prev) return { ok: false, reason: "no_progress" };

  const state = { ...(prev.state as ServerGameState) };
  const board = ensureBoard(state);
  const now = Date.now();

  const cell = board[index];
  if (!cell) return { ok: false, reason: "empty_cell" };

  const energyNow = clampServerEnergy(state.energy, 0);

  // ── Live Target strike ─────────────────────────────────────
  if ((cell as any).isTarget) {
    // We need an attacker. For dedicated deploy endpoint the client should
    // also send the attacker index, but for safety we accept hybrid or
    // the opposite faction of the target side.
    const attackerFaction = isCorrectSide(index, "dog") ? "cat" : "dog";

    if (!canAttackIndex(attackerFaction, index)) {
      return { ok: false, reason: "wrong_side" };
    }

    if (energyNow < ENERGY_PER_MERGE) {
      return { ok: false, reason: "no_energy" };
    }

    const isNation = (cell as any).targetType === "nation";
    const gloryGain = isNation ? 480 : 320;
    const control = isNation ? 12 : 8;

    board[index] = null;
    state.energy = clampServerEnergy(energyNow - ENERGY_PER_MERGE, 0);
    state.glory = Number(state.glory) + gloryGain;
    state.totalMerges = Number(state.totalMerges) + 1;

    if ((state as any).warMode?.active) {
      const wm = (state as any).warMode;
      const attackedDogSide = isCorrectSide(index, "dog");
      const push = attackedDogSide ? -control : control;
      wm.frontLine = Math.max(0, Math.min(100, (wm.frontLine ?? 50) + push));
      wm.controlGenerated = (wm.controlGenerated ?? 0) + control;
      if (Array.isArray(wm.targets)) {
        wm.targets = wm.targets.filter(
          (t: any) => t.id !== (cell as any).targetId,
        );
      }
      (state as any).warMode = wm;
    }

    state.board = board;
    await writeProgress(userId, state, {
      touchSyncClock: true,
      gloryDelta: gloryGain,
    });

    return {
      ok: true,
      state,
      rewardText: isNation
        ? `Struck nation! +${gloryGain} Glory`
        : `Struck player! +${gloryGain} Glory`,
    };
  }

  // ── Normal unit deploy (push front line) ───────────────────
  if (!(state as any).warMode?.active) {
    return { ok: false, reason: "war_mode_not_active" };
  }
  if (energyNow < DEPLOY_ENERGY_COST) {
    return { ok: false, reason: "no_energy" };
  }
  if (cell.tier < 4 && cell.faction !== "hybrid") {
    return { ok: false, reason: "tier_too_low" };
  }
  if ((cell as any).deployedUntil && (cell as any).deployedUntil > now) {
    return { ok: false, reason: "already_deployed" };
  }
  if (cell.faction !== "hybrid" && !isCorrectSide(index, cell.faction)) {
    return { ok: false, reason: "wrong_side" };
  }

  // Deploy only pushes from own side – already enforced above
  board[index] = {
    ...cell,
    deployedUntil: now + DEPLOY_COOLDOWN_MS,
  } as any;

  const gain = 9 + (cell.faction === "hybrid" ? 8 : 0);
  const wm = (state as any).warMode;
  let frontLine = wm.frontLine ?? 50;

  if (cell.faction === "dog") {
    frontLine = Math.max(0, frontLine - gain);
  } else if (cell.faction === "cat") {
    frontLine = Math.min(FRONT_LINE_MAX, frontLine + gain);
  } else {
    frontLine =
      Math.random() < 0.5
        ? Math.max(0, frontLine - gain)
        : Math.min(FRONT_LINE_MAX, frontLine + gain);
  }

  wm.frontLine = frontLine;
  wm.controlGenerated = (wm.controlGenerated ?? 0) + gain;
  (state as any).warMode = wm;

  state.energy = clampServerEnergy(energyNow - DEPLOY_ENERGY_COST, 0);
  state.board = board;

  await writeProgress(userId, state, { touchSyncClock: true });
  return { ok: true, state };
}
