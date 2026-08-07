// src/components/board/BoardControls.tsx
import { Swords } from "lucide-react";
import { SPAWN_ENERGY } from "@/lib/game-state";
import { RECOVER_ENERGY_TOKEN_COST } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function FactionLabels() {
  return (
    <div className="mb-1.5 flex items-center justify-between px-1">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_10px_#f97316]" />
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">
          WARDOG
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-purple-400">
          WARCAT
        </span>
        <span className="h-2.5 w-2.5 rounded-full bg-purple-500 shadow-[0_0_10px_#a855f7]" />
      </div>
    </div>
  );
}

export type PayToken = "wardog" | "warcat";

export function BoardActionBar({
  canSpawn,
  onSpawn,
  canRecoverWardog,
  canRecoverWarcat,
  onRecover,
}: {
  canSpawn: boolean;
  onSpawn?: () => void;
  canRecoverWardog: boolean;
  canRecoverWarcat: boolean;
  onRecover?: (payWith: PayToken) => void;
}) {
  return (
    <div className="mt-3 flex items-stretch gap-2">
      <button
        type="button"
        disabled={!canSpawn || !onSpawn}
        onClick={() => onSpawn?.()}
        className={cn(
          "relative flex h-11 flex-1 items-center justify-center gap-1.5 overflow-hidden pl-3 pr-5 text-[13px] font-semibold uppercase tracking-wide transition-all active:scale-[0.98]",
          canSpawn ? "text-orange-400" : "text-zinc-600",
        )}
        style={{
          clipPath:
            "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={
            canSpawn
              ? {
                  background: "rgba(249,115,22,0.1)",
                  border: "1.5px solid rgba(251,146,60,0.6)",
                  clipPath:
                    "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)",
                }
              : {
                  background: "rgba(24,24,27,0.5)",
                  border: "1.5px solid rgba(63,63,70,0.7)",
                  clipPath:
                    "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)",
                }
          }
        />
        <Swords className="relative z-10 h-4 w-4 shrink-0 opacity-90" />
        <span className="relative z-10 truncate">
          Deploy · {SPAWN_ENERGY}⚡
        </span>
      </button>

      <div className="flex flex-[1.1] gap-1.5">
        <button
          type="button"
          disabled={!canRecoverWardog || !onRecover}
          onClick={() => onRecover?.("wardog")}
          title={`Recharge · ${RECOVER_ENERGY_TOKEN_COST} $WARDOG`}
          className={cn(
            "relative flex h-11 flex-1 items-center justify-center rounded-[10px] text-[11px] font-black uppercase tracking-wide transition-all active:scale-[0.98]",
            canRecoverWardog ? "text-red-300" : "text-zinc-600",
          )}
          style={
            canRecoverWardog
              ? {
                  background: "rgba(239,68,68,0.12)",
                  border: "1.5px solid rgba(248,113,113,0.55)",
                }
              : {
                  background: "rgba(24,24,27,0.5)",
                  border: "1.5px solid rgba(63,63,70,0.7)",
                }
          }
        >
          ⚡ WD
        </button>
        <button
          type="button"
          disabled={!canRecoverWarcat || !onRecover}
          onClick={() => onRecover?.("warcat")}
          title={`Recharge · ${RECOVER_ENERGY_TOKEN_COST} $WARCAT`}
          className={cn(
            "relative flex h-11 flex-1 items-center justify-center rounded-[10px] text-[11px] font-black uppercase tracking-wide transition-all active:scale-[0.98]",
            canRecoverWarcat ? "text-violet-300" : "text-zinc-600",
          )}
          style={
            canRecoverWarcat
              ? {
                  background: "rgba(139,92,246,0.12)",
                  border: "1.5px solid rgba(167,139,250,0.55)",
                }
              : {
                  background: "rgba(24,24,27,0.5)",
                  border: "1.5px solid rgba(63,63,70,0.7)",
                }
          }
        >
          ⚡ WC
        </button>
      </div>
    </div>
  );
}

export function BoardBrandFooter() {
  return (
    <div className="mb-1 mt-4 select-none px-1">
      <div className="relative overflow-hidden rounded-xl border border-zinc-800/90 bg-black/60 px-3 py-3">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "linear-gradient(90deg, rgba(249,115,22,0.12) 0%, transparent 42%, transparent 58%, rgba(168,85,247,0.12) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(249,115,22,0.55), rgba(255,255,255,0.35), rgba(168,85,247,0.55), transparent)",
          }}
        />

        <div className="relative flex flex-col items-center gap-1.5">
          <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0 tracking-[0.28em]">
            <span className="text-[11px] font-black uppercase text-orange-400 drop-shadow-[0_0_12px_rgba(249,115,22,0.45)]">
              War
            </span>
            <span className="text-[11px] font-black uppercase text-zinc-200">
              On
            </span>
            <span className="text-[11px] font-black uppercase text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]">
              Nations
            </span>
          </div>

          <div className="flex w-full max-w-[220px] items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-orange-500/50" />
            <div className="h-1 w-1 rotate-45 bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-purple-500/50" />
          </div>

          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-500">
            Merge · Build · Conquer
          </div>
        </div>
      </div>
    </div>
  );
}
