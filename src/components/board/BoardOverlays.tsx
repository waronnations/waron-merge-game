// src/components/board/BoardOverlays.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Eye, X } from "lucide-react";
import { UnitChip } from "@/components/board/BoardCell";
import type { ZoomCellInfo, HybridMenuInfo } from "@/components/board/use-board-gestures";
import {
  HYBRID_SACRIFICE_GLORY,
  HYBRID_SACRIFICE_WARDOG,
  HYBRID_SACRIFICE_WARCAT,
} from "@/lib/constants";

export type ZoomCell = ZoomCellInfo;
export type HybridMenuCell = HybridMenuInfo;

export function BoardOverlays({
  zoomCell,
  hybridMenu,
  setZoomCell,
  setHybridMenu,
  dismissOverlays,
  onSacrificeHybrid,
}: {
  zoomCell: ZoomCell | null;
  hybridMenu: HybridMenuCell | null;
  setZoomCell: (v: ZoomCell | null) => void;
  setHybridMenu: (v: HybridMenuCell | null) => void;
  dismissOverlays: () => void;
  onSacrificeHybrid?: (idx: number) => void;
}) {
  return (
    <>
      <AnimatePresence>
        {zoomCell && (
          <motion.button
            type="button"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismissOverlays}
            onContextMenu={(e) => e.preventDefault()}
          >
            <motion.div
              className="h-52 w-52"
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.7 }}
              onClick={(e) => e.stopPropagation()}
            >
              <UnitChip
                tier={zoomCell.tier}
                faction={zoomCell.faction}
                id={zoomCell.id}
                seed={zoomCell.seed}
                imageUrl={zoomCell.imageUrl}
                variant={zoomCell.variant}
                large
              />
            </motion.div>
            <span className="absolute bottom-10 text-xs font-bold uppercase tracking-widest text-zinc-400">
              Tap to close
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hybridMenu && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismissOverlays}
          >
            <motion.div
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-b from-zinc-900 via-black to-zinc-950 shadow-2xl"
              initial={{ y: 40, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 30, scale: 0.96 }}
              transition={{ type: "spring", damping: 24 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center px-6 pt-6">
                <div className="h-28 w-28">
                  <UnitChip
                    tier={hybridMenu.tier}
                    faction="hybrid"
                    id={hybridMenu.id}
                    seed={hybridMenu.seed}
                    imageUrl={hybridMenu.imageUrl}
                    large
                  />
                </div>
              </div>

              <div className="px-5 pb-2 pt-4 text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/80">
                  {hybridMenu.imageUrl ? "AI Hybrid Trophy" : "Hybrid Unit"}
                </div>
                <div className="mt-1 text-lg font-black text-white">
                  Tier‑6 Hybrid
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {hybridMenu.imageUrl
                    ? "Unique art · stays in your collection after sacrifice"
                    : "Procedural unit · free board space when sacrificed"}
                </p>
              </div>

              <div className="space-y-2 px-4 pb-5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setZoomCell({
                      idx: hybridMenu.idx,
                      tier: hybridMenu.tier,
                      faction: "hybrid",
                      id: hybridMenu.id,
                      seed: hybridMenu.seed,
                      imageUrl: hybridMenu.imageUrl,
                    });
                    setHybridMenu(null);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-600/60 bg-zinc-900/80 py-3.5 text-sm font-bold text-zinc-200 active:bg-zinc-800"
                >
                  <Eye className="h-4 w-4" />
                  Inspect
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const idx = hybridMenu.idx;
                    dismissOverlays();
                    onSacrificeHybrid?.(idx);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/50 bg-red-950/60 py-3.5 text-sm font-bold text-red-300 active:bg-red-900/70"
                >
                  <Flame className="h-4 w-4" />
                  Sacrifice · +{HYBRID_SACRIFICE_GLORY} Glory · +{HYBRID_SACRIFICE_WARDOG} each
                </button>

                <button
                  type="button"
                  onClick={dismissOverlays}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 active:text-zinc-300"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
