// src/components/nations/use-nations-panel.ts
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  getMyNationFn,
  listNationsFn,
  joinNationFn,
  leaveNationFn,
  getNationDetailsFn,
  buyNationFn,
  listNationForSaleFn,
  unlistNationFn,
  transferOwnershipFn,
  getNationMembersFn,
  donateToVaultFn,
  activateNationBuffFn,
  promoteOfficerFn,
  demoteOfficerFn,
  activateProtectionFn,
  getNationHistoryFn,
  kickMemberFn,
  setRedemptionPriceFn,
  redeemTraitorFn,
} from "@/lib/nations.functions";
import { haptic } from "@/lib/telegram";
import { track, trackOnce } from "@/lib/analytics";
import { toast } from "sonner";
import {
  DEFAULT_PROTECTED_JOIN_CONTRIBUTION,
  NATION_BUFFS,
  type NationBuffId,
} from "@/lib/constants";
import { usePayments } from "@/components/payments/PaymentProvider";
import type { PaidActionId } from "@/lib/payments";
import { getErrorMessage, showNationError } from "./errors";
import { PROTECTION_COST } from "./panel-helpers";

export type Nation = Awaited<ReturnType<typeof listNationsFn>>[number];
export type MyNation = Awaited<ReturnType<typeof getMyNationFn>>;
export type NationDetails = NonNullable<
  Awaited<ReturnType<typeof getNationDetailsFn>>
>;
export type NationMember = Awaited<
  ReturnType<typeof getNationMembersFn>
>[number];
export type NationHistoryRow = Awaited<
  ReturnType<typeof getNationHistoryFn>
>[number];
export type PayToken = "wardog" | "warcat";

export { getErrorMessage, showNationError } from "./errors";
export { PROTECTION_COST } from "./panel-helpers";

export function useNationsPanel({
  referralCode,
  onEconomyChange,
}: {
  referralCode?: string | null;
  onEconomyChange?: () => void | Promise<void>;
} = {}) {
  const { pay } = usePayments();

  const [myNation, setMyNation] = useState<MyNation>(null);
  const [nations, setNations] = useState<Nation[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NationDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [buying, setBuying] = useState(false);

  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState("10");
  const [listing, setListing] = useState(false);
  const [unlisting, setUnlisting] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [members, setMembers] = useState<NationMember[]>([]);
  const [transferring, setTransferring] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(
    null,
  );

  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donateWardog, setDonateWardog] = useState("");
  const [donateWarcat, setDonateWarcat] = useState("");
  const [donating, setDonating] = useState(false);
  const [activatingBuff, setActivatingBuff] = useState<string | null>(null);

  const [promoting, setPromoting] = useState<number | null>(null);
  const [demoting, setDemoting] = useState<number | null>(null);

  const [activatingProtection, setActivatingProtection] = useState(false);
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [redemptionWardog, setRedemptionWardog] = useState("15");
  const [redemptionWarcat, setRedemptionWarcat] = useState("15");
  const [settingRedemption, setSettingRedemption] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [showJoinContributionModal, setShowJoinContributionModal] =
    useState(false);
  const [pendingJoinId, setPendingJoinId] = useState<number | null>(null);
  const [pendingContribution, setPendingContribution] = useState({
    wardog: DEFAULT_PROTECTED_JOIN_CONTRIBUTION.wardog,
    warcat: DEFAULT_PROTECTED_JOIN_CONTRIBUTION.warcat,
  });

  const [history, setHistory] = useState<NationHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [kicking, setKicking] = useState<number | null>(null);

  /** Wallet gate: connect if needed (stays until disconnect), no native TON. */
  const withWallet = useCallback(
    async (action: PaidActionId): Promise<boolean> => {
      const res = await pay(action);
      if (!res.ok) {
        if (res.reason !== "cancelled") {
          toast.error("Wallet authorization required");
        }
        return false;
      }
      return true;
    },
    [pay],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, list] = await Promise.all([
        getMyNationFn(),
        listNationsFn(),
      ]);
      setMyNation(mine);
      setNations(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load Nations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return nations;
    const q = search.toLowerCase();
    return nations.filter(
      (n) =>
        n.name.toLowerCase().includes(q) || n.tag.toLowerCase().includes(q),
    );
  }, [nations, search]);

  const openDetails = async (nationId: number) => {
    setDetailsLoading(true);
    setSelected(null);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const [details, hist] = await Promise.all([
        getNationDetailsFn({ data: { nationId } }),
        getNationHistoryFn({ data: { nationId } }).catch(
          () => [] as NationHistoryRow[],
        ),
      ]);
      setSelected(details);
      setHistory(hist);
      haptic("light");
    } catch {
      toast.error("Could not load nation details");
    } finally {
      setDetailsLoading(false);
      setHistoryLoading(false);
    }
  };

  const handleJoin = async (nationId: number) => {
    if (joiningId) return;
    try {
      setJoiningId(nationId);
      haptic("medium");
      const res = await joinNationFn({ data: { nationId } });
      setMyNation(res);
      trackOnce("first_nation_join", { nationId, role: res?.myRole });
      toast.success(
        res?.myRole === "leader"
          ? `You claimed ${res.name} as Leader!`
          : `Joined ${res?.name}`,
      );
      await load();
      await onEconomyChange?.();
      setSelected(null);
    } catch (e) {
      showNationError(e, "Could not join nation");
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async () => {
    if (leaving || !myNation) return;
    try {
      setLeaving(true);
      haptic("medium");
      await leaveNationFn();
      setMyNation(null);
      toast.success("You left the nation");
      await load();
      await onEconomyChange?.();
    } catch (e) {
      showNationError(e, "Could not leave nation");
    } finally {
      setLeaving(false);
    }
  };

  /** Buy nation: wallet auth → spend chosen token */
  const handleBuy = async (
    nationId: number,
    payWith: PayToken = "wardog",
  ) => {
    if (buying) return;
    try {
      setBuying(true);
      if (!(await withWallet("nation:buy"))) return;
      haptic("heavy");
      await buyNationFn({ data: { nationId, payWith } });
      toast.success(
        `Nation purchased with $${payWith === "wardog" ? "WARDOG" : "WARCAT"}!`,
      );
      await load();
      await onEconomyChange?.();
      setSelected(null);
    } catch (e) {
      showNationError(e, "Purchase failed");
    } finally {
      setBuying(false);
    }
  };

  const handleListForSale = async () => {
    const price = parseFloat(listPrice);
    if (isNaN(price) || price < 0.5 || price > 10000) {
      toast.error("Price must be between 0.5 and 10 000");
      return;
    }
    try {
      setListing(true);
      haptic("medium");
      await listNationForSaleFn({ data: { price } });
      toast.success(`Nation listed for ${price} tokens`);
      setShowListModal(false);
      await load();
      if (selected) await openDetails(selected.id);
    } catch (e) {
      showNationError(e, "Could not list nation");
    } finally {
      setListing(false);
    }
  };

  const handleUnlist = async () => {
    try {
      setUnlisting(true);
      haptic("medium");
      await unlistNationFn();
      toast.success("Nation unlisted");
      await load();
      if (selected) await openDetails(selected.id);
    } catch (e) {
      showNationError(e, "Could not unlist");
    } finally {
      setUnlisting(false);
    }
  };

  const openTransferModal = async () => {
    if (!myNation) return;
    try {
      const m = await getNationMembersFn({ data: { nationId: myNation.id } });
      setMembers(m.filter((x) => x.role !== "leader"));
      setShowTransferModal(true);
      haptic("light");
    } catch {
      toast.error("Could not load members");
    }
  };

  const handleTransfer = async () => {
    if (!selectedTransferId) return;
    try {
      setTransferring(true);
      haptic("heavy");
      await transferOwnershipFn({ data: { toUserId: selectedTransferId } });
      toast.success("Leadership transferred");
      setShowTransferModal(false);
      setSelectedTransferId(null);
      await load();
      setSelected(null);
    } catch (e) {
      showNationError(e, "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  const handleDonate = async () => {
    if (!selected) return;
    const w = parseFloat(donateWardog) || 0;
    const c = parseFloat(donateWarcat) || 0;
    if (w <= 0 && c <= 0) {
      toast.error("Enter an amount");
      return;
    }
    try {
      setDonating(true);
      haptic("medium");
      await donateToVaultFn({
        data: { nationId: selected.id, wardog: w, warcat: c },
      });
      toast.success("Donation successful!");
      setShowDonateModal(false);
      setDonateWardog("");
      setDonateWarcat("");
      await load();
      await openDetails(selected.id);
      await onEconomyChange?.();
    } catch (e) {
      showNationError(e, "Donation failed");
    } finally {
      setDonating(false);
    }
  };

  /** Buff: wallet auth → vault spend */
  const activateBuff = async (buffId: NationBuffId) => {
    try {
      setActivatingBuff(buffId);
      const action = `nation:buff:${buffId}` as PaidActionId;
      if (!(await withWallet(action))) return;
      haptic("medium");
      await activateNationBuffFn({ data: { buffId } });
      track("nation_buff", { buffId });
      toast.success(`${NATION_BUFFS[buffId]?.name ?? "Buff"} activated!`);
      if (selected) await openDetails(selected.id);
      await load();
      await onEconomyChange?.();
    } catch (e) {
      showNationError(e, "Could not activate buff");
    } finally {
      setActivatingBuff(null);
    }
  };

  const handlePromote = async (toUserId: number) => {
    try {
      setPromoting(toUserId);
      haptic("medium");
      await promoteOfficerFn({ data: { toUserId } });
      toast.success("Promoted to Officer");
      if (selected) await openDetails(selected.id);
      await load();
    } catch (e) {
      showNationError(e, "Promote failed");
    } finally {
      setPromoting(null);
    }
  };

  const handleDemote = async (toUserId: number) => {
    try {
      setDemoting(toUserId);
      haptic("medium");
      await demoteOfficerFn({ data: { toUserId } });
      toast.success("Demoted to Member");
      if (selected) await openDetails(selected.id);
      await load();
    } catch (e) {
      showNationError(e, "Demote failed");
    } finally {
      setDemoting(null);
    }
  };

  /** Protection: wallet auth → vault spend (not personal TON) */
  const handleActivateProtection = async () => {
    try {
      setActivatingProtection(true);
      if (!(await withWallet("nation:protect"))) return;
      haptic("medium");
      await activateProtectionFn();
      track("nation_protect");
      toast.success("24h protection activated");
      if (selected) await openDetails(selected.id);
      await load();
    } catch (e) {
      showNationError(e, "Could not activate protection");
    } finally {
      setActivatingProtection(false);
    }
  };

  const handleSetRedemptionPrice = async () => {
    if (settingRedemption) return;
    try {
      setSettingRedemption(true);
      haptic("medium");
      await setRedemptionPriceFn({
        data: {
          wardog: Math.max(0, Number(redemptionWardog) || 0),
          warcat: Math.max(0, Number(redemptionWarcat) || 0),
        },
      });
      toast.success("Redemption price updated");
      setShowRedemptionModal(false);
      if (selected) await openDetails(selected.id);
      await load();
    } catch (e) {
      showNationError(e, "Could not set redemption price");
    } finally {
      setSettingRedemption(false);
    }
  };

  /**
   * Paid redeem: wallet auth → spend chosen token.
   * Cooldown path: free, no wallet.
   */
  const handleRedeemTraitor = async (
    payFlag: boolean,
    payWith: PayToken = "wardog",
  ) => {
    if (redeeming) return;
    try {
      setRedeeming(true);
      if (payFlag) {
        if (!(await withWallet("nation:redeem"))) return;
      }
      haptic("medium");
      await redeemTraitorFn({
        data: payFlag ? { pay: true, payWith } : { pay: false },
      });
      toast.success(
        payFlag
          ? `Redeemed with $${payWith === "wardog" ? "WARDOG" : "WARCAT"}`
          : "Traitor mark cleared (cooldown)",
      );
      await load();
      await onEconomyChange?.();
    } catch (e) {
      showNationError(e, "Redemption failed");
    } finally {
      setRedeeming(false);
    }
  };

  const requestJoin = async (nationId: number) => {
    const target = nations.find((n) => n.id === nationId);
    const protectedUntil = target?.protectionExpiresAt
      ? new Date(target.protectionExpiresAt).getTime()
      : 0;
    if (protectedUntil > Date.now()) {
      setPendingJoinId(nationId);
      setPendingContribution({
        wardog: DEFAULT_PROTECTED_JOIN_CONTRIBUTION.wardog,
        warcat: DEFAULT_PROTECTED_JOIN_CONTRIBUTION.warcat,
      });
      setShowJoinContributionModal(true);
      return;
    }
    await handleJoin(nationId);
  };

  const confirmJoinWithContribution = () => {
    const id = pendingJoinId;
    setShowJoinContributionModal(false);
    setPendingJoinId(null);
    if (id != null) void handleJoin(id);
  };

  const handleKick = async (targetUserId: number) => {
    try {
      setKicking(targetUserId);
      haptic("medium");
      await kickMemberFn({ data: { targetUserId } });
      toast.success("Member kicked");
      if (selected) await openDetails(selected.id);
      await load();
    } catch (e) {
      showNationError(e, "Kick failed");
    } finally {
      setKicking(null);
    }
  };

  const isLeader = myNation?.myRole === "leader";
  const canManageBuffs =
    selected?.myRole === "leader" || selected?.myRole === "officer";

  return {
    myNation,
    nations,
    loading,
    joiningId,
    leaving,
    search,
    setSearch,
    selected,
    setSelected,
    detailsLoading,
    buying,
    showListModal,
    setShowListModal,
    listPrice,
    setListPrice,
    listing,
    unlisting,
    showTransferModal,
    setShowTransferModal,
    members,
    transferring,
    selectedTransferId,
    setSelectedTransferId,
    showDonateModal,
    setShowDonateModal,
    donateWardog,
    setDonateWardog,
    donateWarcat,
    setDonateWarcat,
    donating,
    activatingBuff,
    promoting,
    demoting,
    filtered,
    load,
    openDetails,
    handleJoin,
    handleLeave,
    handleBuy,
    handleListForSale,
    handleUnlist,
    openTransferModal,
    handleTransfer,
    handleDonate,
    activateBuff,
    handlePromote,
    handleDemote,
    isLeader,
    canManageBuffs,
    activatingProtection,
    handleActivateProtection,
    showRedemptionModal,
    setShowRedemptionModal,
    protectionCost: PROTECTION_COST,
    history,
    historyLoading,
    kicking,
    handleKick,
    redemptionWardog,
    setRedemptionWardog,
    redemptionWarcat,
    setRedemptionWarcat,
    settingRedemption,
    handleSetRedemptionPrice,
    redeeming,
    handleRedeemTraitor,
    showJoinContributionModal,
    setShowJoinContributionModal,
    pendingContribution,
    requestJoin,
    confirmJoinWithContribution,
  };
}
