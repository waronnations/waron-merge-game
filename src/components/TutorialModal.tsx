// src/components/TutorialModal.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Zap, Trophy, Coins, Flag, Flame } from "lucide-react";
import { STARTER_PACK } from "@/lib/game-state";
import { haptic } from "@/lib/telegram";

interface Props {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  {
    icon: Swords,
    title: "Merge your pack",
    body: "Drag two units of the same faction, same tier, and same variant onto each other. Dogs with dogs, cats with cats. Higher tiers are stronger.",
  },
  {
    icon: Zap,
    title: "Manage energy",
    body: "Merges and deploys cost energy. It regenerates over time. Spend tokens in the Shop for an instant refill when you need it.",
  },
  {
    icon: Flame,
    title: "Hybrid clash",
    body: "Merge a max-tier WARDOG with a max-tier WARCAT to create a Tier-6 Hybrid. Sacrifice it for big rewards or keep it on the board.",
  },
  {
    icon: Coins,
    title: "Earn dual tokens",
    body: "Merges drop $WARDOG and $WARCAT. Claim them later or spend them in the Shop, Nations vault, and more.",
  },
  {
    icon: Flag,
    title: "Claim Nations",
    body: "Join WARDOG or WARCAT, or claim a real country. First joiner becomes leader. Compete, donate to the vault, and activate buffs.",
  },
  {
    icon: Trophy,
    title: "Climb the ranks",
    body: "Glory takes you from Recruit to Warlord. Complete quests, refer friends, and dominate the leaderboard.",
  },
];

export function TutorialModal({ open, onComplete, onSkip }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-700 bg-gradient-to-br from-zinc-950 to-black p-6 shadow-2xl"
          >
            <div className="text-center">
              <div className="text-[0.6rem] uppercase tracking-[0.35em] text-amber-500">
                Briefing
              </div>
              <h2 className="mt-1 text-xl font-black uppercase tracking-widest text-white">
                Welcome, Commander
              </h2>
            </div>

            <div className="mt-5 space-y-2.5">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
                  >
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-black uppercase tracking-wider text-white">
                        {i + 1}. {s.title}
                      </div>
                      <p className="mt-1 text-[0.7rem] leading-snug text-zinc-400">
                        {s.body}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-center">
              <div className="text-[0.6rem] uppercase tracking-widest text-amber-500">
                Starter Supply Drop
              </div>
              <div className="mt-1 text-[0.7rem] font-black text-white">
                +{STARTER_PACK.glory} Glory · +{STARTER_PACK.energy}⚡ · +
                {STARTER_PACK.wardog} $WARDOG · +{STARTER_PACK.warcat} $WARCAT
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  haptic("light");
                  onSkip();
                }}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-[0.7rem] font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-800"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  haptic("medium");
                  onComplete();
                }}
                className="flex-[2] rounded-xl bg-amber-600 py-3 text-xs font-black uppercase tracking-widest text-black active:scale-[0.98]"
              >
                Deploy & Claim Pack
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
