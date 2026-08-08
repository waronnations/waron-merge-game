// src/components/nuke/StrikeResultCard.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Skull, ShieldAlert, X } from "lucide-react";

export interface NukeResult {
  ok: boolean;
  glory?: number;
  energy?: number;
  tokens?: number;
  transferred?: number;
  wasPeaceful?: boolean;
  becameTerrorist?: boolean;
  targetName?: string;
  reason?: string;
}

export function StrikeResultCard({
  lastResult,
  phase,
  setLastResult,
  shareStrikeTelegram,
  shareStrikeX,
}: {
  lastResult: NukeResult | null;
  phase: "idle" | "launch" | "impact";
  setLastResult: (v: null) => void;
  shareStrikeTelegram: () => void;
  shareStrikeX: () => void;
}) {
  return (
    <AnimatePresence>
      {lastResult?.ok && phase === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="relative rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-center"
        >
          <button
            type="button"
            onClick={() => setLastResult(null)}
            className="absolute right-3 top-3 rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="text-lg font-black text-white">☢ Strike successful</div>
          <div className="mt-1 text-sm text-zinc-300">
            {lastResult.targetName} has been hit
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {lastResult.glory != null && (
              <div>
                <div className="font-bold text-white">
                  +{lastResult.glory.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500">Glory</div>
              </div>
            )}
            {lastResult.energy != null && (
              <div>
                <div className="font-bold text-white">+{lastResult.energy}</div>
                <div className="text-[10px] text-zinc-500">Energy</div>
              </div>
            )}
            {lastResult.tokens != null && (
              <div>
                <div className="font-bold text-white">
                  +{lastResult.tokens.toFixed(2)}
                </div>
                <div className="text-[10px] text-zinc-500">Tokens</div>
              </div>
            )}
          </div>

          {lastResult.transferred != null && (
            <p className="mt-3 text-xs text-zinc-400">
              {lastResult.transferred} tokens sent to their vault
            </p>
          )}

          {lastResult.wasPeaceful && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
              <ShieldAlert className="h-3.5 w-3.5" />
              Peaceful nation — reduced rewards
            </div>
          )}

          {lastResult.becameTerrorist && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-red-300">
              <Skull className="h-3.5 w-3.5" />
              You are now marked as a TERRORIST
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={shareStrikeTelegram}
              className="min-h-[2.5rem] rounded-xl bg-white py-2.5 text-xs font-black uppercase tracking-widest text-black hover:bg-zinc-200"
            >
              Share Telegram
            </button>
            <button
              type="button"
              onClick={shareStrikeX}
              className="min-h-[2.5rem] rounded-xl border border-zinc-600 bg-zinc-950 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:border-zinc-400"
            >
              Share on X
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
