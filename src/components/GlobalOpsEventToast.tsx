// src/components/GlobalOpsEventToast.tsx
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { listOpsKillFeedFn } from "@/lib/battlefield.functions";

/**
 * Polls the global OPS kill feed and shows a short toast
 * to every player when someone is stabbed/shot or gets jailed
 * for attacking a protected World Leader.
 */
export function GlobalOpsEventToast() {
  const seenRef = useRef<Set<number>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const list = await listOpsKillFeedFn({ data: { limit: 12 } });
        if (cancelled || !Array.isArray(list)) return;

        if (!primedRef.current) {
          for (const s of list) seenRef.current.add(s.id);
          primedRef.current = true;
          return;
        }

        for (const s of list) {
          if (seenRef.current.has(s.id)) continue;
          seenRef.current.add(s.id);

          if (s.jailed) {
            toast(
              `🔒 ${s.attackerName} tried to attack protected Leader ${s.victimName} and got JAILED`,
              {
                duration: 5500,
                className:
                  "border border-amber-500/50 bg-amber-950/90 text-amber-100",
              },
            );
          } else if (s.hit) {
            const weapon =
              s.weaponId === "knife"
                ? "stabbed"
                : s.weaponId === "pistol"
                  ? "shot"
                  : "hit";
            toast(
              `⚔️ ${s.attackerName} ${weapon} ${s.victimName} (+${s.gloryGained} glory)`,
              {
                duration: 4500,
                className:
                  "border border-red-500/40 bg-red-950/90 text-red-100",
              },
            );
          }
        }
      } catch {
        // silent
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 7000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return null;
}
