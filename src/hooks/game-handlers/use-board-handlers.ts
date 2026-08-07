// src/hooks/game-handlers/use-board-handlers.ts
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { haptic } from "@/lib/telegram";
import { trackOnce } from "@/lib/analytics";
import {
  COMBO_WINDOW_MS,
  MAX_COMBO,
  getComboMultiplier,
} from "@/lib/constants";
import { type useGame } from "@/lib/game-state";

/**
 * Board is LOCAL-FIRST for fast play.
 * spawn / merge / swap / sacrifice apply immediately on the client.
 * Debounced forceSync persists state in the background.
 * Per-action server commits lag and fight the board (stale_placement / invalid_merge).
 */
export function useBoardHandlers({
  game,
  serverReady,
  forceSync,
  softRateLimitToast,
}: {
  game: ReturnType<typeof useGame>;
  serverReady: boolean;
  forceSync: () => Promise<unknown>;
  pullFromServer: () => Promise<unknown>;
  serverMerge: (
    from: number,
    to: number,
  ) => Promise<{ ok: boolean; reason?: string }>;
  serverSpawn: (args?: {
    targetIdx?: number;
    faction?: "cat" | "dog";
  }) => Promise<{ ok: boolean; state?: unknown; reason?: string }>;
  serverSwap: (
    from: number,
    to: number,
  ) => Promise<{ ok: boolean; reason?: string }>;
  serverResolveHybrid: (
    choice: "sacrifice" | "keep",
  ) => Promise<{ ok: boolean; reason?: string }>;
  serverSacrificeBoardHybrid?: (
    idx: number,
  ) => Promise<{ ok: boolean; reason?: string; state?: unknown }>;
  softRateLimitToast: () => void;
}) {
  const lastMergeAtRef = useRef(0);
  const comboCountRef = useRef(0);
  const syncSoonRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Debounced background persist — never blocks the board */
  const queueBackgroundSync = useCallback(() => {
    if (!serverReady) return;
    if (syncSoonRef.current) clearTimeout(syncSoonRef.current);
    syncSoonRef.current = setTimeout(() => {
      syncSoonRef.current = null;
      void forceSync().catch(() => {
        softRateLimitToast();
      });
    }, 400);
  }, [serverReady, forceSync, softRateLimitToast]);

  const handleSpawn = useCallback(() => {
    const local = game.spawnUnit();
    if (!local.ok) return;
    haptic("light");
    queueBackgroundSync();
  }, [game, queueBackgroundSync]);

  const handleMerge = useCallback(
    (
      from: number,
      to: number,
    ): {
      ok: boolean;
      token?: "wardog" | "warcat";
      amount?: number;
      isHybrid?: boolean;
    } => {
      const now = Date.now();
      if (now - lastMergeAtRef.current <= COMBO_WINDOW_MS) {
        comboCountRef.current = Math.min(MAX_COMBO, comboCountRef.current + 1);
      } else {
        comboCountRef.current = 1;
      }
      lastMergeAtRef.current = now;

      const combo = comboCountRef.current;
      const mult = getComboMultiplier(combo);

      const res = game.tryMerge(from, to, mult, combo);
      if (!res.ok) return res;

      trackOnce("first_merge", { token: res.token, isHybrid: res.isHybrid });
      queueBackgroundSync();
      return res;
    },
    [game, queueBackgroundSync],
  );

  const handleSwap = useCallback(
    (from: number, to: number) => {
      game.swap(from, to);
      queueBackgroundSync();
    },
    [game, queueBackgroundSync],
  );

  const handleSacrificeHybrid = useCallback(
    (idx: number) => {
      const res = game.sacrificeBoardHybrid(idx);
      if (!res.ok) return;
      haptic("heavy");
      toast.success(`+${res.glory} Glory · +${res.wardog} / +${res.warcat}`, {
        duration: 1600,
      });
      queueBackgroundSync();
    },
    [game, queueBackgroundSync],
  );

  const handleResolveHybrid = useCallback(
    (choice: "sacrifice" | "keep") => {
      game.resolveHybrid(choice);
      if (choice === "sacrifice") {
        toast.success("+2800 Glory · +3 tokens each", { duration: 1600 });
      }
      queueBackgroundSync();
    },
    [game, queueBackgroundSync],
  );

  return {
    handleSpawn,
    handleMerge,
    handleSwap,
    handleSacrificeHybrid,
    handleResolveHybrid,
  };
}
