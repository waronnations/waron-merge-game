// src/components/HybridResultModal.tsx
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import {
  HYBRID_SACRIFICE_GLORY,
  HYBRID_SACRIFICE_WARDOG,
  HYBRID_SACRIFICE_WARCAT,
} from "@/lib/constants";

interface Props {
  open: boolean;
  imageUrl: string | null;
  onResolve: (choice: "keep" | "mint" | "sacrifice") => void;
  onBack: () => void;
}

export function HybridResultModal({
  open,
  imageUrl,
  onResolve,
  onBack,
}: Props) {
  return (
    <AnimatePresence>
      {open && imageUrl && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-b from-zinc-900 to-black p-6 shadow-[0_0_80px_rgba(251,191,36,0.2)]"
            initial={{ scale: 0.85, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 30 }}
          >
            <button
              type="button"
              onClick={onBack}
              className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            <div className="mb-5 mt-6 text-center">
              <div className="mb-1 text-[10px] font-bold tracking-[0.2em] text-amber-400">
                TROPHY ART READY
              </div>
              <h2 className="text-xl font-black text-white">Your Hybrid Look</h2>
              <p className="mt-2 text-xs text-zinc-400">
                Saved as unit art in-game — not an on-chain NFT.
              </p>
            </div>

            <div className="mx-auto mb-6 flex aspect-square w-48 items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-zinc-900 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
              <img
                src={imageUrl}
                alt="Hybrid trophy art"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onResolve("keep")}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-4 text-black shadow-lg shadow-amber-900/40 transition active:scale-[0.98]"
              >
                <div className="font-black">Keep on Board</div>
                <div className="mt-0.5 text-xs font-medium text-black/70">
                  Place this hybrid unit with its trophy art
                </div>
              </button>

              <button
                type="button"
                onClick={() => onResolve("mint")}
                className="w-full rounded-2xl border border-purple-500/40 bg-purple-950/40 py-4 transition hover:bg-purple-900/60"
              >
                <div className="font-bold text-purple-200">
                  Save Trophy + Keep Unit
                </div>
                <div className="mt-0.5 text-xs text-purple-300/80">
                  Same as keep — chain mint coming later
                </div>
              </button>

              <button
                type="button"
                onClick={() => onResolve("sacrifice")}
                className="w-full rounded-2xl border border-red-500/40 bg-red-950/50 py-4 transition hover:bg-red-900/70"
              >
                <div className="font-bold text-red-300">Sacrifice Instead</div>
                <div className="mt-0.5 text-xs text-red-400/80">
                  +{HYBRID_SACRIFICE_GLORY} Glory · +{HYBRID_SACRIFICE_WARDOG} $WARDOG · +
                  {HYBRID_SACRIFICE_WARCAT} $WARCAT
                </div>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
