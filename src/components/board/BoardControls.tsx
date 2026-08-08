// src/components/board/BoardControls.tsx
import { Swords } from "lucide-react";
import { SPAWN_ENERGY } from "@/lib/game-state";
import { RECOVER_ENERGY_TOKEN_COST } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function FactionLabels() {
  return (
    <div className="mb-1.5 flex items-center justify-between px-1">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
          WARDOG
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300">
          WARCAT
        </span>
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.5)]" />
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
          canSpawn ? "text-white" : "text-zinc-600",
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
                  background: "rgba(255,255,255,0.08)",
                  border: "1.5px solid rgba(255,255,255,0.55)",
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
            canRecoverWardog ? "text-white" : "text-zinc-600",
          )}
          style={
            canRecoverWardog
              ? {
                  background: "rgba(255,255,255,0.08)",
                  border: "1.5px solid rgba(255,255,255,0.45)",
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
            canRecoverWarcat ? "text-zinc-200" : "text-zinc-600",
          )}
          style={
            canRecoverWarcat
              ? {
                  background: "rgba(255,255,255,0.06)",
                  border: "1.5px solid rgba(255,255,255,0.35)",
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
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black px-3 py-3.5">
        {/* subtle top highlight line */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
          }}
        />

        <div className="relative flex flex-col items-center gap-2">
          {/* Main brand */}
          <div className="flex items-baseline justify-center gap-x-2 tracking-[0.32em]">
            <span className="text-[12px] font-black uppercase text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]">
              WAR
            </span>
            <span className="text-[12px] font-black uppercase text-zinc-400">
              ON
            </span>
            <span className="text-[12px] font-black uppercase text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]">
              NATIONS
            </span>
          </div>

          {/* Divider */}
          <div className="flex w-full max-w-[200px] items-center gap-2.5">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/40" />
            <div className="h-1.5 w-1.5 rotate-45 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/40" />
          </div>

          <div className="text-[9px] font-medium uppercase tracking-[0.22em] text-zinc-500">
            Merge · Build · Conquer
          </div>
        </div>
      </div>
    </div>
  );
}
