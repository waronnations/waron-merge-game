// src/lib/game/war-targets.ts
import type { GameState, WarTarget, Cell } from "./types";
import {
  TARGET_SPAWN_EVERY_MERGES,
  TARGET_MAX_ON_BOARD,
  TARGET_LIFETIME_MS,
  TARGET_ATTACK_ENERGY_COST,
  TARGET_ATTACK_TOKEN_COST,
  TARGET_NATION_REWARD,
  TARGET_PLAYER_REWARD,
} from "@/lib/constants/war-targets";
import { updateConquerFlags } from "./helpers";

function generateTargetId(): string {
  return `tgt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function findSpawnIndex(board: (Cell | null)[]): number | null {
  const empty: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) empty.push(i);
  }
  if (empty.length === 0) return null;
  const preferred = empty.filter((i) => {
    const col = i % 6;
    return col === 2 || col === 3;
  });
  const pool = preferred.length > 0 ? preferred : empty;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function maybeSpawnTarget(s: GameState, now = Date.now()): GameState {
  if (!s.warMode?.active) return s;

  let mergesSince = (s.warMode.mergesSinceLastTarget ?? 0) + 1;
  let targets = [...(s.warMode.targets || [])].filter((t) => t.expiresAt > now);

  if (
    mergesSince >= TARGET_SPAWN_EVERY_MERGES &&
    targets.length < TARGET_MAX_ON_BOARD
  ) {
    const idx = findSpawnIndex(s.board);
    if (idx !== null) {
      const isNation = Math.random() < 0.55;
      const id = generateTargetId();

      const target: WarTarget = {
        id,
        type: isNation ? "nation" : "player",
        boardIndex: idx,
        spawnedAt: now,
        expiresAt: now + TARGET_LIFETIME_MS,
        nationId: isNation ? "BR" : undefined,
        nationName: isNation ? "Brazil" : undefined,
        playerId: !isNation ? 123456789 : undefined,
        playerName: !isNation ? "EnemySoldier" : undefined,
      };

      const board = [...s.board];
      board[idx] = {
        id: s.nextId,
        faction: "target",
        tier: 1,
        isTarget: true,
        targetType: target.type,
        targetId: id,
        targetLabel: isNation ? "BRAZIL" : "@EnemySoldier",
      };

      targets.push(target);
      mergesSince = 0;

      return {
        ...s,
        board,
        nextId: s.nextId + 1,
        warMode: {
          ...s.warMode,
          targets,
          mergesSinceLastTarget: mergesSince,
        },
      };
    }
  }

  return {
    ...s,
    warMode: {
      ...s.warMode,
      targets,
      mergesSinceLastTarget: mergesSince,
    },
  };
}

export function attackTarget(
  s: GameState,
  boardIndex: number,
  now = Date.now(),
): { nextState: GameState; ok: boolean; reason?: string; rewardText?: string } {
  if (!s.warMode?.active) {
    return { nextState: s, ok: false, reason: "War Mode not active" };
  }

  const cell = s.board[boardIndex];
  if (!cell || !cell.isTarget || !cell.targetId) {
    return { nextState: s, ok: false, reason: "Not a target" };
  }

  if (s.energy < TARGET_ATTACK_ENERGY_COST) {
    return { nextState: s, ok: false, reason: "Not enough energy — top up!" };
  }

  const hasTokens =
    s.wardogTokens >= TARGET_ATTACK_TOKEN_COST ||
    s.warcatTokens >= TARGET_ATTACK_TOKEN_COST;
  if (!hasTokens) {
    return { nextState: s, ok: false, reason: "Need tokens — top up to strike!" };
  }

  const target = s.warMode.targets.find((t) => t.id === cell.targetId);
  if (!target || target.expiresAt < now) {
    return { nextState: s, ok: false, reason: "Target expired" };
  }

  let wardog = s.wardogTokens;
  let warcat = s.warcatTokens;
  if (wardog >= TARGET_ATTACK_TOKEN_COST) {
    wardog -= TARGET_ATTACK_TOKEN_COST;
  } else {
    warcat -= TARGET_ATTACK_TOKEN_COST;
  }

  const reward = target.type === "nation" ? TARGET_NATION_REWARD : TARGET_PLAYER_REWARD;

  const board = [...s.board];
  board[boardIndex] = null;
  const targets = s.warMode.targets.filter((t) => t.id !== target.id);

  let frontLine = s.warMode.frontLine;
  const push = Math.random() > 0.5 ? reward.control : -reward.control;
  frontLine = Math.max(0, Math.min(100, frontLine + push));

  const next: GameState = {
    ...s,
    board,
    energy: s.energy - TARGET_ATTACK_ENERGY_COST,
    wardogTokens: wardog + reward.wardog,
    warcatTokens: warcat + reward.warcat,
    glory: s.glory + reward.glory,
    warMode: {
      ...s.warMode,
      targets,
      frontLine,
      controlGenerated: s.warMode.controlGenerated + reward.control,
    },
  };

  const rewardText =
    target.type === "nation"
      ? `Nuked ${target.nationName}! +${reward.glory} Glory`
      : `Struck ${target.playerName}! +${reward.glory} Glory`;

  return {
    nextState: updateConquerFlags(next),
    ok: true,
    rewardText,
  };
}

export function cleanExpiredTargets(s: GameState, now = Date.now()): GameState {
  if (!s.warMode?.active) return s;
  const alive = (s.warMode.targets || []).filter((t) => t.expiresAt > now);
  if (alive.length === (s.warMode.targets || []).length) return s;

  const board = [...s.board];
  for (const t of s.warMode.targets || []) {
    if (t.expiresAt <= now && board[t.boardIndex]?.targetId === t.id) {
      board[t.boardIndex] = null;
    }
  }

  return {
    ...s,
    board,
    warMode: { ...s.warMode, targets: alive },
  };
}
