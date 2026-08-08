// src/components/nations/NationActions.tsx
import type { NationDetails, NationMember } from "./use-nations-panel";
import { ListModal } from "./actions/ListModal";
import { TransferModal } from "./actions/TransferModal";
import { DonateModal } from "./actions/DonateModal";
import { JoinContributionModal } from "./actions/JoinContributionModal";
import { RedemptionModal } from "./actions/RedemptionModal";

export function NationActions({
  showListModal,
  setShowListModal,
  listPrice,
  setListPrice,
  listing,
  handleListForSale,
  showTransferModal,
  setShowTransferModal,
  members,
  selectedTransferId,
  setSelectedTransferId,
  transferring,
  handleTransfer,
  showDonateModal,
  setShowDonateModal,
  selected,
  donateWardog,
  setDonateWardog,
  donateWarcat,
  setDonateWarcat,
  donating,
  handleDonate,
  // Phase 1
  showJoinContributionModal,
  setShowJoinContributionModal,
  pendingContribution,
  confirmJoinWithContribution,
  joiningId,
  showRedemptionModal,
  setShowRedemptionModal,
  redemptionWardog,
  setRedemptionWardog,
  redemptionWarcat,
  setRedemptionWarcat,
  settingRedemption,
  handleSetRedemptionPrice,
}: {
  showListModal: boolean;
  setShowListModal: (v: boolean) => void;
  listPrice: string;
  setListPrice: (v: string) => void;
  listing: boolean;
  handleListForSale: () => Promise<void>;
  showTransferModal: boolean;
  setShowTransferModal: (v: boolean) => void;
  members: NationMember[];
  selectedTransferId: number | null;
  setSelectedTransferId: (v: number | null) => void;
  transferring: boolean;
  handleTransfer: () => Promise<void>;
  showDonateModal: boolean;
  setShowDonateModal: (v: boolean) => void;
  selected: NationDetails | null;
  donateWardog: string;
  setDonateWardog: (v: string) => void;
  donateWarcat: string;
  setDonateWarcat: (v: string) => void;
  donating: boolean;
  handleDonate: () => Promise<void>;
  showJoinContributionModal: boolean;
  setShowJoinContributionModal: (v: boolean) => void;
  pendingContribution: { wardog: number; warcat: number };
  confirmJoinWithContribution: () => void;
  joiningId: number | null;
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
    <>
      <ListModal
        showListModal={showListModal}
        setShowListModal={setShowListModal}
        listPrice={listPrice}
        setListPrice={setListPrice}
        listing={listing}
        handleListForSale={handleListForSale}
      />

      <TransferModal
        showTransferModal={showTransferModal}
        setShowTransferModal={setShowTransferModal}
        members={members}
        selectedTransferId={selectedTransferId}
        setSelectedTransferId={setSelectedTransferId}
        transferring={transferring}
        handleTransfer={handleTransfer}
      />

      <DonateModal
        showDonateModal={showDonateModal}
        setShowDonateModal={setShowDonateModal}
        selected={selected}
        donateWardog={donateWardog}
        setDonateWardog={setDonateWardog}
        donateWarcat={donateWarcat}
        setDonateWarcat={setDonateWarcat}
        donating={donating}
        handleDonate={handleDonate}
      />

      <JoinContributionModal
        showJoinContributionModal={showJoinContributionModal}
        setShowJoinContributionModal={setShowJoinContributionModal}
        pendingContribution={pendingContribution}
        confirmJoinWithContribution={confirmJoinWithContribution}
        joiningId={joiningId}
      />

      <RedemptionModal
        showRedemptionModal={showRedemptionModal}
        setShowRedemptionModal={setShowRedemptionModal}
        redemptionWardog={redemptionWardog}
        setRedemptionWardog={setRedemptionWardog}
        redemptionWarcat={redemptionWarcat}
        setRedemptionWarcat={setRedemptionWarcat}
        settingRedemption={settingRedemption}
        handleSetRedemptionPrice={handleSetRedemptionPrice}
      />
    </>
  );
}
