// src/components/TopBar.tsx
import { motion } from "framer-motion";
import { Zap, Star, Wallet } from "lucide-react";
import { MAX_ENERGY, type GameState } from "@/lib/game-state";
import { getRank, getLevel } from "@/lib/ranks";
import { cn } from "@/lib/utils";
import { usePayments } from "@/components/payments/PaymentProvider";
import { TopupButton } from "@/components/TopupButton";

export function TopBar({ state }: { state: GameState }) {
  const { rank, next, progress } = getRank(state.glory);
  const level = getLevel(state.glory);
  const energyPct = Math.min(100, (state.energy / MAX_ENERGY) * 100);
  const { connected, address, connectWallet, disconnectWallet } = usePayments();

  return (
    <div className="sticky top-0 z-30 border-b border-zinc-800/80 bg-black/95 px-3 pb-3.5 pt-3.5 backdrop-blur-xl">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-black shadow-inner ring-1 ring-white/10">
              <div className={cn("text-2xl drop-shadow-md", rank.color)}>
                {rank.insignia}
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-black uppercase tracking-widest text-white">
                  {rank.name}
                </div>
                <div className="text-[0.65rem] text-zinc-500">
                  Level {level}
                </div>
              </div>

              {next && (
                <div className="shrink-0 text-right">
                  <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
                    Next
                  </div>
                  <div className="text-xs font-medium text-zinc-300">
                    {next.name}
                  </div>
                </div>
              )}
            </div>

            <div className="relative mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-zinc-300 via-white to-zinc-200"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(3, progress * 100)}%` }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              </div>
              <div className="absolute -top-3.5 right-0 text-[10px] font-mono text-white/50">
                {Math.floor(progress * 100)}%
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-700 bg-zinc-900/90 px-2.5 py-1.5">
              <Star className="h-3.5 w-3.5 text-white" />
              <motion.span
                key={state.glory}
                initial={{ opacity: 0.5, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="tabular-nums text-sm font-black text-white"
              >
                {formatNum(state.glory)}
              </motion.span>
            </div>

            <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-700 bg-zinc-900/90 px-2.5 py-1.5">
              <Zap
                className="h-3.5 w-3.5 text-white"
                fill="currentColor"
              />
              <div className="relative h-1.5 w-14 overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-zinc-300 via-white to-zinc-200"
                  animate={{ width: `${energyPct}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
              <span className="tabular-nums text-xs font-bold text-white/90">
                {state.energy}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <TopupButton className="!px-2 !py-1 !text-[0.55rem]" />
              <button
                type="button"
                title={
                  connected && address
                    ? `Connected ${address.slice(0, 6)}…${address.slice(-4)} · tap to disconnect`
                    : "Connect wallet (required for shop & paid actions)"
                }
                onClick={() => {
                  if (connected) void disconnectWallet();
                  else void connectWallet();
                }}
                className={cn(
                  "flex items-center gap-1 rounded-2xl border px-2 py-1 text-[0.55rem] font-black uppercase tracking-wider transition",
                  connected
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-zinc-700 bg-zinc-900/90 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300",
                )}
              >
                <Wallet className="h-3 w-3" />
                {connected ? "On" : "Off"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.floor(n / 1_000) + "k";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.floor(n).toString();
}
