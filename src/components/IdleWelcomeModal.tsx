// src/components/IdleWelcomeModal.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Check } from "lucide-react";
import type { IdleReward } from "@/lib/game-state";
import { haptic } from "@/lib/telegram";

interface Props {
  reward: IdleReward | null;
  onClose: () => void;
}

function fmtAway(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function IdleWelcomeModal({ reward, onClose }: Props) {
  const [collected, setCollected] = useState(false);

  // Reset animation state whenever a new idle reward appears
  useEffect(() => {
    setCollected(false);
  }, [reward]);

  const handleCollect = () => {
    haptic("medium");
    if (!collected) {
      // Grant happens in parent onClose (claimIdleReward)
      setCollected(true);
      setTimeout(() => onClose(), 700);
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-gradient-to-br from-zinc-950 to-black p-6 shadow-2xl"
          >
            <div className="flex justify-center">
              <div className="rounded-full border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400">
                {collected ? (
                  <Check className="h-6 w-6" />
                ) : (
                  <Moon className="h-6 w-6" />
                )}
              </div>
            </div>

            <h2 className="mt-4 text-center text-lg font-black uppercase tracking-widest text-white">
              {collected ? "Collected!" : "Welcome back, Commander"}
            </h2>

            <p className="mt-1.5 text-center text-[0.7rem] uppercase tracking-wider text-zinc-400">
              {collected
                ? "Your rewards are secured"
                : `Your pack held the line for ${fmtAway(reward.minutes)}`}
            </p>

            {!collected && (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {reward.glory > 0 && (
                  <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3 text-center">
                    <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
                      Glory
                    </div>
                    <div className="mt-0.5 text-sm font-black text-amber-400">
                      +{reward.glory.toLocaleString()}
                    </div>
                  </div>
                )}
                {reward.energy > 0 && (
                  <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3 text-center">
                    <div className="text-[0.6rem] uppercase tracking-wider text-zinc-500">
                      Energy
                    </div>
                    <div className="mt-0.5 text-sm font-black text-cyan-400">
                      +{reward.energy}⚡
                    </div>
                  </div>
                )}
                {reward.wardog > 0 && (
                  <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-center">
                    <div className="text-[0.6rem] uppercase tracking-wider text-red-400">
                      $WARDOG
                    </div>
                    <div className="mt-0.5 text-sm font-black text-white">
                      +{reward.wardog.toFixed(3)}
                    </div>
                  </div>
                )}
                {reward.warcat > 0 && (
                  <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3 text-center">
                    <div className="text-[0.6rem] uppercase tracking-wider text-violet-400">
                      $WARCAT
                    </div>
                    <div className="mt-0.5 text-sm font-black text-white">
                      +{reward.warcat.toFixed(3)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleCollect}
              className={`mt-6 w-full rounded-xl py-3.5 text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
                collected
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-600 text-black"
              }`}
            >
              {collected ? "Tap to Continue" : "Collect"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
