// src/components/nations/actions/JoinContributionModal.tsx
import { motion, AnimatePresence } from "framer-motion";

export function JoinContributionModal({
  showJoinContributionModal,
  setShowJoinContributionModal,
  pendingContribution,
  confirmJoinWithContribution,
  joiningId,
}: {
  showJoinContributionModal: boolean;
  setShowJoinContributionModal: (v: boolean) => void;
  pendingContribution: { wardog: number; warcat: number };
  confirmJoinWithContribution: () => void;
  joiningId: number | null;
}) {
  return (
    <AnimatePresence>
      {showJoinContributionModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowJoinContributionModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-emerald-500/40 bg-zinc-950 p-5"
          >
            <h3 className="text-lg font-black text-white">
              Protected Nation
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              This nation is under 24h protection. To join you must contribute
              to the vault:
            </p>
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-center">
              <div className="text-lg font-black text-emerald-400">
                {pendingContribution.wardog} WARDOG + {pendingContribution.warcat} WARCAT
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Leaving later will mark you as a Traitor. You can redeem by
              paying the leader&apos;s price or waiting 7 days (reduced rewards).
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowJoinContributionModal(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-bold text-zinc-300"
              >
                Decline
              </button>
              <button
                onClick={confirmJoinWithContribution}
                disabled={joiningId !== null}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {joiningId !== null ? "Joining..." : "Accept & Join"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
