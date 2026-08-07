// src/components/DailyBonusModal.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Gift } from "lucide-react";
import { haptic } from "@/lib/telegram";

export function DailyBonusModal({
  open,
  streak,
  onClaim,
  onClose,
}: {
  open: boolean;
  streak: number;
  onClaim: () => void;
  onClose: () => void;
}) {
  // Matches game-state.ts: 100 + streak * 25 glory, 30 energy
  const glory = 100 + streak * 25;
  const energy = 30;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-amber-500/40 bg-gradient-to-br from-zinc-950 to-black p-6 text-center shadow-2xl"
          >
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full border border-amber-500/40 bg-amber-500/15">
              <Gift className="h-8 w-8 text-amber-400" />
            </div>

            <h2 className="text-lg font-black uppercase tracking-widest text-white">
              Field Rations
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Day {streak + 1} of your daily streak
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
                <div className="text-xl font-black text-amber-400">
                  +{glory.toLocaleString()}
                </div>
                <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
                  Glory
                </div>
              </div>
              <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
                <div className="text-xl font-black text-cyan-400">
                  +{energy}
                </div>
                <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
                  Energy
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                haptic("medium");
                onClaim();
              }}
              className="mt-6 w-full rounded-xl bg-amber-600 py-3.5 text-sm font-black uppercase tracking-widest text-black active:scale-[0.98]"
            >
              Claim & Deploy
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
