// src/components/nuke/StrikeCinematic.tsx
import { motion, AnimatePresence } from "framer-motion";
import type { NationRow } from "./NationTargetGrid";

export function StrikeCinematic({
  phase,
  selected,
}: {
  phase: "idle" | "launch" | "impact";
  selected: NationRow | null;
}) {
  return (
    <AnimatePresence>
      {(phase === "launch" || phase === "impact") && selected && (
        <motion.div
          key="cinematic"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        >
          {phase === "launch" && (
            <div className="relative flex h-full w-full max-w-md flex-col items-center justify-center px-6">
              <motion.div
                initial={{ opacity: 0.15, scale: 1.2 }}
                animate={{ opacity: 0.35, scale: 1 }}
                className="absolute text-[9rem] leading-none blur-[1px]"
              >
                {selected.emblem}
              </motion.div>
              <motion.div
                initial={{ y: 120, opacity: 0, scale: 0.6 }}
                animate={{ y: -40, opacity: 1, scale: 1.15 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
                className="relative z-10 text-7xl"
              >
                🚀
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative z-10 mt-6 text-sm font-black uppercase tracking-[0.25em] text-red-300"
              >
                Launching on {selected.name}
              </motion.p>
            </div>
          )}

          {phase === "impact" && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.35, 1.1], opacity: [0, 1, 1] }}
              transition={{ duration: 0.42, times: [0, 0.45, 1] }}
              className="flex flex-col items-center"
            >
              <div className="text-8xl drop-shadow-[0_0_40px_rgba(251,146,60,0.8)]">
                💥
              </div>
              <div className="mt-2 text-4xl">{selected.emblem}</div>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.2em] text-orange-300">
                Impact — {selected.name}
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
