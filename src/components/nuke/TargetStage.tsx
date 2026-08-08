// src/components/nuke/TargetStage.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { NUKE_TRANSFER_VALUE } from "@/lib/constants";
import type { NationRow } from "./NationTargetGrid";

export function TargetStage({
  selected,
  canLaunch,
  busy,
  phase,
  handleLaunch,
  owned,
  selectedIsProtected,
}: {
  selected: NationRow | null;
  canLaunch: boolean;
  busy: boolean;
  phase: "idle" | "launch" | "impact";
  handleLaunch: () => void;
  owned: number;
  selectedIsProtected: boolean;
}) {
  return (
    <AnimatePresence mode="wait">
      {selected && (
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl"
        >
          <div className="relative flex flex-col items-center px-4 pb-2 pt-6">
            <motion.div
              key={`flag-${selected.id}`}
              initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative z-10 text-[5.5rem] leading-none"
            >
              {selected.emblem}
            </motion.div>
            <div className="relative z-10 mt-3 text-center">
              <div className="text-xl font-black tracking-wide text-white">
                {selected.name}
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
                {selected.tag}
                {selected.memberCount != null &&
                  ` · ${selected.memberCount} members`}
              </div>
            </div>
            <div className="relative z-10 mt-3 flex flex-wrap justify-center gap-2">
              {selected.isProtected && (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-600 bg-zinc-950 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                  <Shield className="h-3 w-3" />
                  24h Protected
                </span>
              )}
              <span className="rounded-full border border-zinc-600 bg-zinc-950 px-2.5 py-1 text-[10px] font-bold text-zinc-300">
                ☢ Arsenal {Number(selected.nukesOwnedTotal ?? 0)}
              </span>
              <span className="rounded-full border border-zinc-600 bg-zinc-950 px-2.5 py-1 text-[10px] font-bold text-red-300">
                💥 Hit {Number(selected.timesNuked ?? 0)}×
              </span>
            </div>
          </div>

          <div className="border-t border-zinc-800 px-4 py-4">
            {selected.isProtected ? (
              <p className="text-center text-xs text-zinc-400">
                This nation paid for{" "}
                <span className="text-emerald-400">24h protection</span>.
                Strikes are blocked until protection expires.
              </p>
            ) : (
              <p className="text-center text-xs text-zinc-400">
                On impact{" "}
                <span className="font-semibold text-white">
                  {NUKE_TRANSFER_VALUE}
                </span>{" "}
                tokens enter this nation’s vault for rebuilding.
              </p>
            )}

            <button
              type="button"
              disabled={!canLaunch}
              onClick={handleLaunch}
              className={cn(
                "mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black uppercase tracking-widest transition-all",
                canLaunch
                  ? "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-500",
              )}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {phase === "launch" ? "Launching…" : "Impact"}
                </>
              ) : selectedIsProtected ? (
                <>
                  <Shield className="h-4 w-4" />
                  Protected — cannot strike
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4" />
                  Launch strategic nuke
                </>
              )}
            </button>

            {!canLaunch && !busy && (
              <p className="mt-2 text-center text-[11px] text-zinc-500">
                {selectedIsProtected
                  ? "Wait for protection to expire"
                  : owned <= 0
                    ? "Buy a Strategic Nuke in the Shop first"
                    : "Select a target"}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
