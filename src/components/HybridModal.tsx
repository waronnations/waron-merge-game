// src/components/HybridModal.tsx
import { motion, AnimatePresence } from "framer-motion";
import {
  HYBRID_SACRIFICE_GLORY,
  HYBRID_SACRIFICE_WARDOG,
  HYBRID_SACRIFICE_WARCAT,
  HYBRID_KEEP_GLORY,
} from "@/lib/constants";

interface Props {
  open: boolean;
  onResolve: (choice: "sacrifice" | "keep" | "generate") => void;
}

export function HybridModal({ open, onResolve }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/50 bg-gradient-to-b from-zinc-900 via-black to-zinc-950 p-6 shadow-[0_0_100px_rgba(251,191,36,0.3)]"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 40 }}
            transition={{ type: "spring", damping: 22 }}
          >
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500/30 to-purple-500/30 blur-3xl" />

            <div className="relative mb-6 text-center">
              <div className="mb-1 text-[10px] font-bold tracking-[0.25em] text-amber-400">
                HYBRID CLASH
              </div>
              <h2 className="text-2xl font-black text-white">
                Legendary Hybrid Born
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                A WARDOG and WARCAT fused into a Tier‑6 hybrid. Choose its fate —
                this is an in-game unit, not an on-chain NFT yet.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onResolve("sacrifice")}
                className="w-full rounded-2xl border border-red-500/40 bg-red-950/50 py-4 transition hover:bg-red-900/70"
              >
                <div className="font-bold text-red-300">Sacrifice</div>
                <div className="mt-0.5 text-xs text-red-400/80">
                  +{HYBRID_SACRIFICE_GLORY} Glory · +{HYBRID_SACRIFICE_WARDOG} $WARDOG · +
                  {HYBRID_SACRIFICE_WARCAT} $WARCAT
                </div>
              </button>

              <button
                type="button"
                onClick={() => onResolve("keep")}
                className="w-full rounded-2xl border border-amber-500/40 bg-amber-950/30 py-4 transition hover:bg-amber-900/50"
              >
                <div className="font-bold text-amber-300">Keep as Unit</div>
                <div className="mt-0.5 text-xs text-amber-400/80">
                  +{HYBRID_KEEP_GLORY} Glory · Place hybrid on the battlefield
                </div>
              </button>

              <button
                type="button"
                onClick={() => onResolve("generate")}
                className="w-full rounded-2xl border border-purple-500/50 bg-purple-950/50 py-4 transition hover:bg-purple-900/70"
              >
                <div className="font-bold text-purple-300">
                  Generate Unique Art
                </div>
                <div className="mt-0.5 text-xs text-purple-400/80">
                  Optional trophy skin for this hybrid · paid art (when live)
                </div>
              </button>
            </div>

            <p className="mt-5 text-center text-[10px] leading-relaxed text-zinc-500">
              Art is a cosmetic trophy saved to your account. Chain mint / GetGems
              listing is not available yet.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
