// src/lib/game/idle.ts
// Pure idle-reward calculation/claim logic extracted from the useGame hook.
import {
  IDLE_CAP_HOURS,
  IDLE_GLORY_PER_MIN,
  IDLE_MIN_MINUTES,
  IDLE_TOKEN_PER_HOUR,
  MAX_ENERGY,
} from "@/lib/constants";
import type { GameState } from "./types";

/**
 * Computes the idle-reward popup (or a lastSeenAt-only refresh) based on
 * elapsed time since the player was last seen. Returns null when nothing
 * needs to change (e.g. a pending reward is already showing).
 */
export function calculateIdleUpdate(s: GameState): GameState | null {
  // Already showing a pending reward — do not recompute over it
  if (s.pendingIdleReward) return null;

  const now = Date.now();
  const last =
    typeof s.lastSeenAt === "number" && s.lastSeenAt > 0 ? s.lastSeenAt : now;
  const minutes = Math.floor((now - last) / 60_000);

  if (minutes < IDLE_MIN_MINUTES) {
    // Still active — keep timestamp fresh, skip needless writes
    if (now - last < 30_000) return null;
    return { ...s, lastSeenAt: now };
  }

  const cappedMinutes = Math.min(minutes, IDLE_CAP_HOURS * 60);
  const glory = Math.floor(cappedMinutes * IDLE_GLORY_PER_MIN);
  const tokens = +((cappedMinutes / 60) * IDLE_TOKEN_PER_HOUR).toFixed(3);

  return {
    ...s,
    lastSeenAt: now,
    pendingIdleReward: {
      glory,
      energy: Math.min(30, Math.floor(cappedMinutes / 10)),
      wardog: tokens / 2,
      warcat: tokens / 2,
      minutes: cappedMinutes,
    },
  };
}

export function claimIdleRewardState(s: GameState): GameState | null {
  if (!s.pendingIdleReward) return null;
  const r = s.pendingIdleReward;
  return {
    ...s,
    glory: s.glory + r.glory,
    energy: Math.min(MAX_ENERGY, s.energy + r.energy),
    wardogTokens: s.wardogTokens + r.wardog,
    warcatTokens: s.warcatTokens + r.warcat,
    pendingIdleReward: null,
    lastSeenAt: Date.now(),
  };
}

export function dismissIdleRewardState(s: GameState): GameState | null {
  if (!s.pendingIdleReward) return null;
  return {
    ...s,
    pendingIdleReward: null,
    lastSeenAt: Date.now(),
  };
}
