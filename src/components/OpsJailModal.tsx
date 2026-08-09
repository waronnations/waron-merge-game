// src/components/OpsJailModal.tsx
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldAlert, Share2 } from "lucide-react";
import { getOpsJailStatusFn } from "@/lib/battlefield.functions";
import { OPS_PROTECTED_LEADER_JAIL_MS } from "@/lib/constants";
import { haptic, shareStrikeRevenge } from "@/lib/telegram";
import { buildReferralLink } from "@/lib/referrals.shared";
import { toast } from "sonner";

export function OpsJailModal() {
  const [remainingMs, setRemainingMs] = useState(0);
  const [reason, setReason] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getOpsJailStatusFn();
      setRemainingMs(s.remainingMs);
      setReason(s.reason);
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2500);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (remainingMs <= 0) return;
    const id = setInterval(() => {
      setRemainingMs((ms) => Math.max(0, ms - 200));
    }, 200);
    return () => clearInterval(id);
  }, [remainingMs > 0]);

  const open = remainingMs > 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const progress = open
    ? Math.min(1, remainingMs / OPS_PROTECTED_LEADER_JAIL_MS)
    : 0;

  const shareRevengeFromJail = () => {
    const referralLink = buildReferralLink(""); // falls back safely
    shareStrikeRevenge({ weaponId: "knife", referralLink });
    haptic("medium");
    toast.success("Share revenge — pick their chat");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-600/60 bg-gradient-to-b from-amber-950 via-black to-zinc-950 p-6 shadow-[0_0_120px_rgba(245,158,11,0.4)]"
            initial={{ scale: 0.85, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 22 }}
          >
            <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-amber-600/30 blur-3xl" />

            <div className="relative flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/50 bg-amber-950/80">
                <Lock className="h-8 w-8 animate-pulse text-amber-400" />
              </div>

              <div className="text-[10px] font-bold tracking-[0.3em] text-amber-400">
                WORLD LEADER PROTECTION
              </div>

              <h2 className="mt-2 text-2xl font-black uppercase tracking-wide text-white">
                YOU ARE IN JAIL
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                You attacked an important World Leader.
                <br />
                Take your jail time and lose glory points and WARDOG / WARCAT.
              </p>

              <div className="mt-6 flex flex-col items-center">
                <div className="text-6xl font-black tabular-nums tracking-tighter text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.55)]">
                  {seconds}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-500/80">
                  seconds remaining
                </div>
              </div>

              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
                <motion.div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-amber-600 to-yellow-500"
                  style={{ scaleX: progress }}
                  transition={{ duration: 0.2, ease: "linear" }}
                />
              </div>

              <button
                type="button"
                onClick={shareRevengeFromJail}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/60 py-2.5 text-xs font-black uppercase tracking-wider text-amber-200 hover:bg-amber-900/60"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share Revenge
              </button>

              <p className="mt-4 flex items-center gap-1.5 text-[10px] leading-relaxed text-zinc-500">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                All operations locked until the countdown ends.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
