// src/components/nations/actions/DonateModal.tsx
import { motion, AnimatePresence } from "framer-motion";
import type { NationDetails } from "../use-nations-panel";

export function DonateModal({
  showDonateModal,
  setShowDonateModal,
  selected,
  donateWardog,
  setDonateWardog,
  donateWarcat,
  setDonateWarcat,
  donating,
  handleDonate,
}: {
  showDonateModal: boolean;
  setShowDonateModal: (v: boolean) => void;
  selected: NationDetails | null;
  donateWardog: string;
  setDonateWardog: (v: string) => void;
  donateWarcat: string;
  setDonateWarcat: (v: string) => void;
  donating: boolean;
  handleDonate: () => Promise<void>;
}) {
  return (
    <AnimatePresence>
      {showDonateModal && selected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowDonateModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 p-5"
          >
            <h3 className="text-lg font-black text-white">
              Donate to Vault
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Support {selected.name}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-zinc-400">WARDOG</label>
                <input
                  type="number"
                  value={donateWardog}
                  onChange={(e) => setDonateWardog(e.target.value)}
                  min="0"
                  step="0.1"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-amber-500/50 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">WARCAT</label>
                <input
                  type="number"
                  value={donateWarcat}
                  onChange={(e) => setDonateWarcat(e.target.value)}
                  min="0"
                  step="0.1"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-amber-500/50 focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowDonateModal(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-bold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDonate}
                disabled={donating}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-black text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {donating ? "Donating..." : "Donate"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
