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
          className={cn(
            "overflow-hidden rounded-2xl border bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-xl",
            selected.isProtected
              ? "border-emerald-500/40 shadow-emerald-950/40"
              : "border-red-500/30 shadow-red-950/40",
          )}
        >
          <div className="relative flex flex-col items-center px-4 pb-2 pt-6">
            <div
              className={cn(
                "pointer-events-none absolute inset-0",
                selected.isProtected
                  ? "bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.15)_0%,_transparent_65%)]"
                  : "bg-[radial-gradient(ellipse_at_center,_rgba(239,68,68,0.18)_0%,_transparent_65%)]",
              )}
            />
            <motion.div
              key={`flag-${selected.id}`}
              initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className={cn(
                "relative z-10 text-[5.5rem] leading-none",
                selected.isProtected
                  ? "drop-shadow-[0_0_28px_rgba(16,185,129,0.4)]"
                  : "drop-shadow-[0_0_28px_rgba(239,68,68,0.45)]",
              )}
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
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                  <Shield className="h-3 w-3" />
                  24h Protected
                </span>
              )}
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                ☢ Arsenal {Number(selected.nukesOwnedTotal ?? 0)}
              </span>
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-300">
                💥 Hit {Number(selected.timesNuked ?? 0)}×
              </span>
            </div>
          </div>

          <div className="border-t border-zinc-800/80 px-4 py-4">
            {selected.isProtected ? (
              <p className="text-center text-xs text-emerald-300/90">
                This nation paid for 24h protection. Strikes are blocked until
                protection expires.
              </p>
            ) : (
              <p className="text-center text-xs text-zinc-400">
                On impact{" "}
                <span className="font-semibold text-amber-300">
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
                  ? "bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 text-white shadow-lg shadow-red-900/50 active:scale-[0.98]"
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
