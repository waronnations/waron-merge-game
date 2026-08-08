// src/components/GlobalStrikeToast.tsx
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getRecentStrikesFn } from "@/lib/nations.functions";

/**
 * Polls recent strategic strikes and shows a short toast
 * for every player in the game when a nation is hit.
 */
export function GlobalStrikeToast() {
  const seenRef = useRef<Set<number>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const list = await getRecentStrikesFn();
        if (cancelled || !Array.isArray(list)) return;

        // First load: only mark as seen (no spam of old strikes)
        if (!primedRef.current) {
          for (const s of list) seenRef.current.add(s.id);
          primedRef.current = true;
          return;
        }

        // Newest first — show new ones
        for (const s of list) {
          if (seenRef.current.has(s.id)) continue;
          seenRef.current.add(s.id);

          const who =
            s.attackerNationName ||
            s.attackerName ||
            "Unknown commander";
          const target = `${s.targetEmblem} ${s.targetName}`;

          toast(`☢ ${target} struck by ${who}`, {
            duration: 4500,
            className: "border border-red-500/40 bg-red-950/90 text-red-100",
          });
        }
      } catch {
        // silent
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return null;
}
