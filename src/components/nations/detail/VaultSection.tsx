// src/components/nations/detail/VaultSection.tsx
import { Coins, Shield } from "lucide-react";
import type { NationDetails } from "../use-nations-panel";

export function VaultSection({
  selected,
  setShowDonateModal,
}: {
  selected: NationDetails;
  setShowDonateModal: (v: boolean) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
          <Coins className="h-4 w-4" />
          Nation Vault
        </div>
        {selected.isMember && (
          <button
            onClick={() => setShowDonateModal(true)}
            className="rounded-lg bg-amber-600/20 border border-amber-500/40 px-2.5 py-1 text-[0.65rem] font-bold uppercase text-amber-400 hover:bg-amber-600/30"
          >
            Donate
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-4 text-sm">
        <div>
          <span className="text-zinc-400">WARDOG:</span>{" "}
          <span className="font-bold text-white">
            {Number(selected.vaultWardog || 0).toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-zinc-400">WARCAT:</span>{" "}
          <span className="font-bold text-white">
            {Number(selected.vaultWarcat || 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProtectionStatus({ selected }: { selected: NationDetails }) {
  if (!selected.isProtected) return null;
  return (
    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
        <Shield className="h-4 w-4" />
        Protected (24h)
      </div>
      {selected.protectionExpiresAt && (
        <div className="mt-0.5 text-xs text-zinc-400">
          Until{" "}
          {new Date(selected.protectionExpiresAt).toLocaleString()}
        </div>
      )}
      <div className="mt-1 text-xs text-zinc-500">
        Join contribution: {selected.joinContributionWardog} WARDOG
        + {selected.joinContributionWarcat} WARCAT
      </div>
    </div>
  );
}

export function LeaderProtectionControls({
  selected,
  activatingProtection,
  handleActivateProtection,
  setShowRedemptionModal,
  protectionCost,
}: {
  selected: NationDetails;
  activatingProtection: boolean;
  handleActivateProtection: () => Promise<void>;
  setShowRedemptionModal: (v: boolean) => void;
  protectionCost: { wardog: number; warcat: number };
}) {
  if (selected.myRole !== "leader") return null;
  return (
    <div className="mt-3 space-y-2">
      {!selected.isProtected && (
        <button
          onClick={() => void handleActivateProtection()}
          disabled={activatingProtection}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 py-2.5 text-sm font-bold text-emerald-400 disabled:opacity-50"
        >
          <Shield className="h-4 w-4" />
          {activatingProtection
            ? "Activating..."
            : `Activate 24h Protection (${protectionCost.wardog}+${protectionCost.warcat} from vault)`}
        </button>
      )}
      <button
        onClick={() => setShowRedemptionModal(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900 py-2.5 text-sm font-bold text-zinc-300"
      >
        Set Traitor Redemption Price
        <span className="text-xs text-zinc-500">
          ({selected.redemptionPriceWardog}/
          {selected.redemptionPriceWarcat})
        </span>
      </button>
    </div>
  );
}
