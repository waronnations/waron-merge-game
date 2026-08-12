// src/hooks/use-recent-ops-players.ts
import { useEffect, useState } from "react";
import { listOpsKillFeedFn } from "@/lib/battlefield.functions";

/**
 * Returns a list of real recent player names from the OPS Kill Feed.
 * Used by War Mode to spawn real targets instead of placeholders.
 */
export function useRecentOpsPlayers(limit = 20) {
  const [players, setPlayers] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const feed = await listOpsKillFeedFn({ data: { limit } });
        if (cancelled || !Array.isArray(feed)) return;

        const names = new Set<string>();
        for (const entry of feed) {
          // Adjust these fields according to the real kill-feed shape
          const name =
            entry?.attackerName ||
            entry?.targetName ||
            entry?.username ||
            entry?.displayName;
          if (typeof name === "string" && name.length > 1) {
            names.add(name.replace("@", "").slice(0, 12));
          }
        }
        setPlayers(Array.from(names));
      } catch {
        // silent – fall back to placeholders
      }
    };

    void load();
    const id = setInterval(load, 60_000); // refresh every minute
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [limit]);

  return players;
}
