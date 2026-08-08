// src/components/nations/actions/ListModal.tsx
import { motion, AnimatePresence } from "framer-motion";

export function ListModal({
  showListModal,
  setShowListModal,
  listPrice,
  setListPrice,
  listing,
  handleListForSale,
}: {
  showListModal: boolean;
  setShowListModal: (v: boolean) => void;
  listPrice: string;
  setListPrice: (v: string) => void;
  listing: boolean;
  handleListForSale: () => Promise<void>;
}) {
  return (
    <AnimatePresence>
      {showListModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowListModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 p-5"
          >
            <h3 className="text-lg font-black text-white">
              List Nation for Sale
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Price in tokens (0.5 – 10 000). Selling marks you as Traitor.
            </p>
            <input
              type="number"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              min="0.5"
              max="10000"
              step="0.1"
              className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white focus:border-amber-500/50 focus:outline-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowListModal(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-bold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleListForSale}
                disabled={listing}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {listing ? "Listing..." : "List"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
