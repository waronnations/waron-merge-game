// src/components/ConquestModal.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Flame } from "lucide-react";
import {
  HYBRID_SACRIFICE_GLORY,
  HYBRID_SACRIFICE_WARDOG,
  HYBRID_SACRIFICE_WARCAT,
} from "@/lib/constants";

interface Props {
  open: boolean;
  side: "dog" | "cat";
  hybridCount: number;
  onMassSacrifice: () => void;
}

export function ConquestModal({
  open,
  side,
  hybridCount,
  onMassSacrifice,
}: Props) {
  const sideName = side === "dog" ? "WARDOG" : "WARCAT";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-400/60 bg-gradient-to-b from-amber-950/80 via-black to-zinc-950 p-6 shadow-[0_0_120px_rgba(251,191,36,0.45)]"
            initial={{ scale: 0.75, y: 60 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 40 }}
            transition={{ type: "spring", damping: 20 }}
          >
            <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400/40 to-red-500/30 blur-3xl" />

            <div className="relative mb-6 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 border border-amber-400/50">
                <Crown className="h-8 w-8 text-amber-300" />
              </div>

              <div className="mb-1 text-[11px] font-bold tracking-[0.3em] text-amber-400">
                CONQUEST EVENT
              </div>
              <h2 className="text-3xl font-black text-white leading-tight">
                YOU WON THE WAR!
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                Your hybrids have conquered the{" "}
                <span className="font-bold text-amber-300">{sideName}</span>{" "}
                board ({hybridCount} hybrids).
                <br />
                <span className="text-zinc-400">
                  Mass sacrifice them now to claim the victory spoils.
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={onMassSacrifice}
              className="w-full rounded-2xl border border-red-400/60 bg-gradient-to-r from-red-950/80 to-amber-950/60 py-5 transition hover:from-red-900/90 hover:to-amber-900/70 active:scale-[0.98]"
            >
              <div className="flex items-center justify-center gap-2 font-black text-lg text-red-200">
                <Flame className="h-5 w-5" />
                MASS SACRIFICE HYBRIDS
              </div>
              <div className="mt-1 text-xs text-red-300/90">
                +{HYBRID_SACRIFICE_GLORY} Glory × {hybridCount} × 1.5 · +
                {HYBRID_SACRIFICE_WARDOG} $WARDOG / $WARCAT each
              </div>
            </button>

            <p className="mt-5 text-center text-[10px] leading-relaxed text-zinc-500">
              This clears all hybrids on the {sideName} side and awards the
              full conquest bonus. Remaining normal units stay on the board.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
