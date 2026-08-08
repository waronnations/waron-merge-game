// src/components/nations/NationDetail.tsx
import { motion, AnimatePresence } from "framer-motion";
import type { NationDetails, NationHistoryRow, PayToken } from "./use-nations-panel";
import type { NationBuffId } from "@/lib/constants";
import { DetailHeader } from "./detail/DetailHeader";
import {
  VaultSection,
  ProtectionStatus,
  LeaderProtectionControls,
} from "./detail/VaultSection";
import { BuffsSection } from "./detail/BuffsSection";
import { LeaderCard } from "./detail/LeaderCard";
import { StatsGrid } from "./detail/StatsGrid";
import { MembersList } from "./detail/MembersList";
import { HistoryList } from "./detail/HistoryList";
import { ActionFooter } from "./detail/ActionFooter";

export function NationDetail({
  selected,
  setSelected,
  detailsLoading,
  canManageBuffs,
  activatingBuff,
  activateBuff,
  isLeader,
  promoting,
  demoting,
  handlePromote,
  handleDemote,
  handleJoin,
  joiningId,
  handleBuy,
  buying,
  setShowDonateModal,
  activatingProtection,
  handleActivateProtection,
  setShowRedemptionModal,
  protectionCost,
  history = [],
  historyLoading = false,
  kicking = null,
  handleKick,
}: {
  selected: NationDetails | null;
  setSelected: (v: NationDetails | null) => void;
  detailsLoading: boolean;
  canManageBuffs: boolean;
  activatingBuff: string | null;
  activateBuff: (buffId: NationBuffId) => Promise<void>;
  isLeader: boolean;
  promoting: number | null;
  demoting: number | null;
  handlePromote: (toUserId: number) => Promise<void>;
  handleDemote: (toUserId: number) => Promise<void>;
  handleJoin: (nationId: number) => void;
  joiningId: number | null;
  handleBuy: (nationId: number, payWith: PayToken) => Promise<void>;
  buying: boolean;
  setShowDonateModal: (v: boolean) => void;
  activatingProtection: boolean;
  handleActivateProtection: () => Promise<void>;
  setShowRedemptionModal: (v: boolean) => void;
  protectionCost: { wardog: number; warcat: number };
  history?: NationHistoryRow[];
  historyLoading?: boolean;
  kicking?: number | null;
  handleKick?: (targetUserId: number) => Promise<void>;
}) {
  return (
    <AnimatePresence>
      {(selected || detailsLoading) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl"
          >
            {detailsLoading || !selected ? (
              <div className="py-16 text-center text-sm text-zinc-500">
                Loading...
              </div>
            ) : (
              <>
                <DetailHeader selected={selected} setSelected={setSelected} />

                <VaultSection
                  selected={selected}
                  setShowDonateModal={setShowDonateModal}
                />

                <ProtectionStatus selected={selected} />

                <LeaderProtectionControls
                  selected={selected}
                  activatingProtection={activatingProtection}
                  handleActivateProtection={handleActivateProtection}
                  setShowRedemptionModal={setShowRedemptionModal}
                  protectionCost={protectionCost}
                />

                <BuffsSection
                  canManageBuffs={canManageBuffs}
                  activatingBuff={activatingBuff}
                  activateBuff={activateBuff}
                />

                <LeaderCard selected={selected} />

                <StatsGrid selected={selected} />

                <MembersList
                  selected={selected}
                  isLeader={isLeader}
                  promoting={promoting}
                  demoting={demoting}
                  handlePromote={handlePromote}
                  handleDemote={handleDemote}
                  kicking={kicking}
                  handleKick={handleKick}
                />

                <HistoryList history={history} historyLoading={historyLoading} />

                <ActionFooter
                  selected={selected}
                  handleJoin={handleJoin}
                  joiningId={joiningId}
                  handleBuy={handleBuy}
                  buying={buying}
                />
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
