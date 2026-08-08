// src/components/nations/actions/RedemptionModal.tsx
import { motion, AnimatePresence } from "framer-motion";

export function RedemptionModal({
  showRedemptionModal,
  setShowRedemptionModal,
  redemptionWardog,
  setRedemptionWardog,
  redemptionWarcat,
  setRedemptionWarcat,
  settingRedemption,
  handleSetRedemptionPrice,
}: {
  showRedemptionModal: boolean;
  setShowRedemptionModal: (v: boolean) => void;
  redemptionWardog: string;
  setRedemptionWardog: (v: string) => void;
  redemptionWarcat: string;
  setRedemptionWarcat: (v: string) => void;
  settingRedemption: boolean;
  handleSetRedemptionPrice: () => Promise<void>;
}) {
  return (
    <AnimatePresence>
      {showRedemptionModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowRedemptionModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 p-5"
          >
            <h3 className="text-lg font-black text-white">
              Traitor Redemption Price
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Price a traitor must pay to clear their status (goes to vault).
              Max 200 each.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-zinc-400">WARDOG</label>
                <input
                  type="number"
                  value={redemptionWardog}
                  onChange={(e) => setRedemptionWardog(e.target.value)}
                  min="0"
                  max="200"
                  step="1"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">WARCAT</label>
                <input
                  type="number"
                  value={redemptionWarcat}
                  onChange={(e) => setRedemptionWarcat(e.target.value)}
                  min="0"
                  max="200"
                  step="1"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowRedemptionModal(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-bold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSetRedemptionPrice}
                disabled={settingRedemption}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-black text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {settingRedemption ? "Saving..." : "Save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
