// src/components/NukedLockModal.tsx
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radiation } from "lucide-react";
import { NUKE_HIT_DISABLE_MS } from "@/lib/constants";
import { getMyNationFn } from "@/lib/nations.functions";

interface NationNukeStatus {
  lastNukeReceivedAt: string | null;
  name: string | null;
}

/**
 * Full-screen blocking modal shown to every member of a nation
 * that was just hit by a Strategic Nuke.
 * Player cannot dismiss it and cannot interact with the game
 * until the 60-second countdown reaches zero.
 *
 * Self-polls getMyNationFn so it works without extra props from the page.
 */
export function NukedLockModal() {
  const [status, setStatus] = useState<NationNukeStatus>({
    lastNukeReceivedAt: null,
    name: null,
  });
  const [remainingMs, setRemainingMs] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const nation = await getMyNationFn();
      if (!nation) {
        setStatus({ lastNukeReceivedAt: null, name: null });
        return;
      }
      setStatus({
        lastNukeReceivedAt: (nation as any).lastNukeReceivedAt ?? null,
        name: nation.name ?? null,
      });
    } catch {
      // silent — keep previous status
    }
  }, []);

  // Poll nation status
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  // Live countdown
  useEffect(() => {
    if (!status.lastNukeReceivedAt) {
      setRemainingMs(0);
      return;
    }

    const receivedAt = new Date(status.lastNukeReceivedAt).getTime();
    if (Number.isNaN(receivedAt)) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      const left = Math.max(0, receivedAt + NUKE_HIT_DISABLE_MS - Date.now());
      setRemainingMs(left);
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [status.lastNukeReceivedAt]);

  const open = remainingMs > 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const progress = open
    ? Math.min(1, remainingMs / NUKE_HIT_DISABLE_MS)
    : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-red-600/60 bg-gradient-to-b from-red-950 via-black to-zinc-950 p-6 shadow-[0_0_120px_rgba(220,38,38,0.45)]"
            initial={{ scale: 0.85, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 22 }}
          >
            <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-red-600/40 blur-3xl" />

            <div className="relative flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/50 bg-red-950/80">
                <Radiation className="h-8 w-8 animate-pulse text-red-400" />
              </div>

              <div className="text-[10px] font-bold tracking-[0.3em] text-red-400">
                STRATEGIC STRIKE
              </div>

              <h2 className="mt-2 text-2xl font-black uppercase tracking-wide text-white">
                NATION NUKED
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                {status.name ? (
                  <>
                    <span className="font-semibold text-red-300">
                      {status.name}
                    </span>{" "}
                    has been hit by a Strategic Nuke.
                  </>
                ) : (
                  "Your nation has been hit by a Strategic Nuke."
                )}
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                All operations locked. Wait for the countdown.
              </p>

              <div className="mt-6 flex flex-col items-center">
                <div className="text-6xl font-black tabular-nums tracking-tighter text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.6)]">
                  {seconds}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-red-500/80">
                  seconds remaining
                </div>
              </div>

              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
                <motion.div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-red-600 to-orange-500"
                  style={{ scaleX: progress }}
                  transition={{ duration: 0.2, ease: "linear" }}
                />
              </div>

              <p className="mt-5 text-[10px] leading-relaxed text-zinc-600">
                You cannot merge, spawn, swap, or launch nukes until the lock
                expires. After 5 minutes you may strike back for revenge.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
