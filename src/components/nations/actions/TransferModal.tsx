// src/components/nations/actions/TransferModal.tsx
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { TraitorBadge, OfficerBadge } from "../badges";
import type { NationMember } from "../use-nations-panel";

export function TransferModal({
  showTransferModal,
  setShowTransferModal,
  members,
  selectedTransferId,
  setSelectedTransferId,
  transferring,
  handleTransfer,
}: {
  showTransferModal: boolean;
  setShowTransferModal: (v: boolean) => void;
  members: NationMember[];
  selectedTransferId: number | null;
  setSelectedTransferId: (v: number | null) => void;
  transferring: boolean;
  handleTransfer: () => Promise<void>;
}) {
  return (
    <AnimatePresence>
      {showTransferModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowTransferModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm max-h-[70vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-5"
          >
            <h3 className="text-lg font-black text-white">
              Transfer Leadership
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Choose a member to become the new Leader.
            </p>
            <div className="mt-4 space-y-2">
              {members.length === 0 ? (
                <div className="py-6 text-center text-sm text-zinc-500">
                  No other members
                </div>
              ) : (
                members.map((m) => (
                  <button
                    key={m.userId}
                    onClick={() => setSelectedTransferId(m.userId)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left",
                      selectedTransferId === m.userId
                        ? "border-blue-500 bg-blue-950/40"
                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-500",
                    )}
                  >
                    <span className="text-sm font-medium text-white">
                      {m.username
                        ? `@${m.username}`
                        : m.firstName || `#${m.userId}`}
                    </span>
                    <div className="flex items-center gap-1">
                      {m.isTraitor && <TraitorBadge />}
                      {m.role === "officer" && <OfficerBadge />}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setSelectedTransferId(null);
                }}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-bold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!selectedTransferId || transferring}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {transferring ? "Transferring..." : "Transfer"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
