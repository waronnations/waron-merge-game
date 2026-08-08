// src/lib/game/server-reconcile.ts
// Server-snapshot reconciliation (applyServerState / applyServerEconomy /
// hydrate) extracted from the useGame hook. Preserves nuke economy fields
// as authoritative from the server.
import { LOCAL_BOARD_LOCK_MS, STARTER_PACK, TERRORIST_THRESHOLD } from "@/lib/constants";
import type { GameState } from "./types";
import { clampEnergy, sanitizeBoard } from "./helpers";

export interface ReconcileRefs {
  boardRevision: number;
  localBoardLockUntil: number;
}

export function hydrateState(
  s: GameState,
  partial: Partial<GameState>,
): GameState {
  return {
    ...s,
    ...partial,
    board: partial.board ? sanitizeBoard(partial.board) : s.board,
    energy:
      partial.energy !== undefined ? clampEnergy(partial.energy) : s.energy,
  };
}

export interface ApplyServerStateOutcome {
  next: GameState;
  preferLocalBoard: boolean;
}

/**
 * Reconciles a server snapshot with the local optimistic state.
 * - Prefer local board under lock / higher (or equal) units / merges not lower
 * - This prevents rearrange-on-reopen when the player only swapped units
 * - Never re-introduce pendingIdleReward from server
 * - Always take authoritative nuke economy fields from server
 */
export function applyServerStateLogic(
  s: GameState,
  incoming: GameState,
  refs: ReconcileRefs,
): ApplyServerStateOutcome {
  const serverBoard = sanitizeBoard(incoming.board);
  const localUnits = s.board.filter(Boolean).length;
  const serverUnits = serverBoard.filter(Boolean).length;
  const underLocalLock = Date.now() < refs.localBoardLockUntil;

  // Prefer local board whenever unit count is equal-or-higher and merges are not lower.
  // This keeps player-arranged positions across reopen / hydrate.
  const preferLocalBoard =
    underLocalLock ||
    localUnits > serverUnits ||
    (localUnits >= serverUnits &&
      s.totalMerges >= Number(incoming.totalMerges || 0)) ||
    (refs.boardRevision > 0 &&
      (s.totalMerges >= Number(incoming.totalMerges) ||
        localUnits >= serverUnits));

  const localEnergy = clampEnergy(s.energy);
  const rawServerEnergy = Number(incoming.energy);
  const serverEnergy = Number.isFinite(rawServerEnergy)
    ? clampEnergy(rawServerEnergy)
    : STARTER_PACK.energy;
  const nextEnergy = preferLocalBoard ? localEnergy : serverEnergy;

  const localAch = new Set(s.achievements ?? []);
  for (const id of incoming.achievements ?? []) localAch.add(id);

  const now = Date.now();

  const next: GameState = {
    ...incoming,
    board: preferLocalBoard ? sanitizeBoard(s.board) : serverBoard,
    energy: nextEnergy,

    glory: Math.max(s.glory, Number(incoming.glory) || 0),
    totalMerges: Math.max(s.totalMerges, Number(incoming.totalMerges) || 0),
    highestTier: Math.max(s.highestTier, Number(incoming.highestTier) || 1),

    wardogTokens: Number(incoming.wardogTokens) || 0,
    warcatTokens: Number(incoming.warcatTokens) || 0,
    lastRegenAt:
      nextEnergy < localEnergy
        ? now
        : typeof incoming.lastRegenAt === "number" &&
            Number.isFinite(incoming.lastRegenAt)
          ? incoming.lastRegenAt
          : now,
    achievements: Array.from(localAch),
    lastMergeAt: preferLocalBoard
      ? (s.lastMergeAt ?? incoming.lastMergeAt)
      : (incoming.lastMergeAt ?? s.lastMergeAt),
    comboCount: preferLocalBoard
      ? (s.comboCount ?? incoming.comboCount)
      : (incoming.comboCount ?? s.comboCount),
    pendingHybrid: preferLocalBoard
      ? (s.pendingHybrid ?? incoming.pendingHybrid)
      : (incoming.pendingHybrid ?? s.pendingHybrid),
    explosion: preferLocalBoard
      ? (s.explosion ?? incoming.explosion)
      : (incoming.explosion ?? s.explosion),
    hybrids: preferLocalBoard
      ? (s.hybrids ?? incoming.hybrids)
      : (incoming.hybrids ?? s.hybrids),

    // ── Nuke fields – always take server as source of truth ──
    nukesOwned: Number(incoming.nukesOwned ?? s.nukesOwned ?? 0),
    nukesLaunchedToday: Number(
      incoming.nukesLaunchedToday ?? s.nukesLaunchedToday ?? 0,
    ),
    lastNukeDay: Number(incoming.lastNukeDay ?? s.lastNukeDay ?? 0),
    totalNukesLaunched: Number(
      incoming.totalNukesLaunched ?? s.totalNukesLaunched ?? 0,
    ),
    isTerrorist:
      Boolean(incoming.isTerrorist) ||
      Number(incoming.totalNukesLaunched ?? 0) >= TERRORIST_THRESHOLD,
    lastNukeTargetId:
      incoming.lastNukeTargetId !== undefined
        ? incoming.lastNukeTargetId
        : s.lastNukeTargetId,

    // keep deprecated field in sync
    nukesUsedToday: Number(
      incoming.nukesLaunchedToday ??
        incoming.nukesUsedToday ??
        s.nukesLaunchedToday ??
        0,
    ),

    // Never resurrect dismissed idle popup
    pendingIdleReward: s.pendingIdleReward,
    lastSeenAt: Math.max(
      Number(s.lastSeenAt) || 0,
      Number(incoming.lastSeenAt) || 0,
      now,
    ),
  };

  delete (next as any).rouletteSpins;

  return { next, preferLocalBoard };
}

export interface ApplyServerEconomyOutcome {
  next: GameState;
  boardChanged: boolean;
}

/**
 * Patch economy / meta from server commits WITHOUT touching the board
 * (unless incoming.board is explicitly provided, e.g. hybrid resolve).
 * Always accepts authoritative nuke fields from server.
 */
export function applyServerEconomyLogic(
  s: GameState,
  incoming: Partial<GameState>,
): ApplyServerEconomyOutcome {
  const next: GameState = {
    ...s,
    energy:
      incoming.energy !== undefined
        ? clampEnergy(Number(incoming.energy))
        : s.energy,
    glory: Math.max(s.glory, Number(incoming.glory) || 0),
    totalMerges: Math.max(s.totalMerges, Number(incoming.totalMerges) || 0),
    highestTier: Math.max(s.highestTier, Number(incoming.highestTier) || 1),
    wardogTokens:
      incoming.wardogTokens !== undefined
        ? Number(incoming.wardogTokens) || 0
        : s.wardogTokens,
    warcatTokens:
      incoming.warcatTokens !== undefined
        ? Number(incoming.warcatTokens) || 0
        : s.warcatTokens,
    lastRegenAt:
      typeof incoming.lastRegenAt === "number" &&
      Number.isFinite(incoming.lastRegenAt)
        ? incoming.lastRegenAt
        : s.lastRegenAt,
    gloryBoostUntil:
      incoming.gloryBoostUntil !== undefined
        ? Number(incoming.gloryBoostUntil)
        : s.gloryBoostUntil,
    lastMergeAt:
      typeof incoming.lastMergeAt === "number"
        ? Math.max(Number(s.lastMergeAt) || 0, incoming.lastMergeAt)
        : s.lastMergeAt,
    achievements: Array.from(
      new Set([
        ...(s.achievements ?? []),
        ...((incoming.achievements as string[]) ?? []),
      ]),
    ),
    pendingHybrid:
      incoming.pendingHybrid !== undefined
        ? incoming.pendingHybrid
        : s.pendingHybrid,
    hybrids: incoming.hybrids !== undefined ? incoming.hybrids : s.hybrids,
    explosion:
      incoming.explosion !== undefined ? incoming.explosion : s.explosion,
    board: incoming.board ? sanitizeBoard(incoming.board) : s.board,

    // ── Nuke fields (authoritative from server) ─────────────
    nukesOwned:
      incoming.nukesOwned !== undefined
        ? Number(incoming.nukesOwned)
        : s.nukesOwned,
    nukesLaunchedToday:
      incoming.nukesLaunchedToday !== undefined
        ? Number(incoming.nukesLaunchedToday)
        : s.nukesLaunchedToday,
    lastNukeDay:
      incoming.lastNukeDay !== undefined
        ? Number(incoming.lastNukeDay)
        : s.lastNukeDay,
    totalNukesLaunched:
      incoming.totalNukesLaunched !== undefined
        ? Number(incoming.totalNukesLaunched)
        : s.totalNukesLaunched,
    isTerrorist:
      incoming.isTerrorist !== undefined
        ? Boolean(incoming.isTerrorist)
        : s.isTerrorist ||
          Number(incoming.totalNukesLaunched ?? s.totalNukesLaunched) >=
            TERRORIST_THRESHOLD,
    lastNukeTargetId:
      incoming.lastNukeTargetId !== undefined
        ? incoming.lastNukeTargetId
        : s.lastNukeTargetId,
    nukesUsedToday:
      incoming.nukesLaunchedToday !== undefined
        ? Number(incoming.nukesLaunchedToday)
        : incoming.nukesUsedToday !== undefined
          ? Number(incoming.nukesUsedToday)
          : Number(s.nukesUsedToday ?? s.nukesLaunchedToday ?? 0),
  };

  return { next, boardChanged: Boolean(incoming.board) };
}

export { LOCAL_BOARD_LOCK_MS };
