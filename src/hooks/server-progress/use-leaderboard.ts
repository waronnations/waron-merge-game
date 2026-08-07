// src/hooks/server-progress/use-leaderboard.ts
import { useEffect, useState, useCallback } from "react";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/game.functions";

export function useLeaderboard(opts: {
  authenticated: boolean;
  intervalMs?: number;
  limit?: number;
}): {
  entries: LeaderboardEntry[] | null;
  refresh: () => Promise<void>;
} {
  const { authenticated, intervalMs = 15_000, limit = 50 } = opts;
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  const load = useCallback(async () => {
    if (!authenticated) {
      setEntries(null);
      return;
    }
    try {
      const rows = await getLeaderboard({ data: { limit } } as any);
      setEntries(rows);
    } catch {
      setEntries((prev) => prev ?? []);
    }
  }, [authenticated, limit]);

  useEffect(() => {
    if (!authenticated) {
      setEntries(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await getLeaderboard({ data: { limit } } as any);
        if (!cancelled) setEntries(rows);
      } catch {
        if (!cancelled) setEntries((prev) => prev ?? []);
      }
    })();
    const timer = window.setInterval(() => {
      void load();
    }, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authenticated, intervalMs, limit, load]);

  return { entries, refresh: load };
}
