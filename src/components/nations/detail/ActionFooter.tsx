// src/components/nations/detail/ActionFooter.tsx
import { Shield, ShoppingCart, Users } from "lucide-react";
import type { NationDetails, PayToken } from "../use-nations-panel";

export function ActionFooter({
  selected,
  handleJoin,
  joiningId,
  handleBuy,
  buying,
}: {
  selected: NationDetails;
  handleJoin: (nationId: number) => void;
  joiningId: number | null;
  handleBuy: (nationId: number, payWith: PayToken) => Promise<void>;
  buying: boolean;
}) {
  return (
    <div className="mt-5 space-y-2">
      {selected.canClaim && (
        <button
          onClick={() => handleJoin(selected.id)}
          disabled={joiningId === selected.id}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-black uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          <Shield className="h-4 w-4" />
          {joiningId === selected.id
            ? "Claiming..."
            : "Claim as Leader"}
        </button>
      )}

      {!selected.isMember &&
        !selected.isDefault &&
        selected.memberCount > 0 &&
        !selected.canBuy && (
          <button
            onClick={() => handleJoin(selected.id)}
            disabled={joiningId === selected.id}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-sm font-bold text-white hover:border-zinc-500 disabled:opacity-50"
          >
            <Users className="h-4 w-4" />
            {joiningId === selected.id
              ? "Joining..."
              : selected.isProtected
                ? "Join (contribution required)"
                : "Join Nation"}
          </button>
        )}

      {/* Buy with chosen token — never TON */}
      {selected.canBuy && selected.listedPrice && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
            <ShoppingCart className="h-3.5 w-3.5" />
            Buy for {selected.listedPrice} of one token
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                void handleBuy(selected.id, "wardog")
              }
              disabled={buying}
              className="rounded-xl border border-red-500/50 bg-red-950/40 py-3 text-[0.7rem] font-black uppercase tracking-wider text-red-300 disabled:opacity-50"
            >
              {buying ? "..." : `$WARDOG · ${selected.listedPrice}`}
            </button>
            <button
              type="button"
              onClick={() =>
                void handleBuy(selected.id, "warcat")
              }
              disabled={buying}
              className="rounded-xl border border-violet-500/50 bg-violet-950/40 py-3 text-[0.7rem] font-black uppercase tracking-wider text-violet-300 disabled:opacity-50"
            >
              {buying ? "..." : `$WARCAT · ${selected.listedPrice}`}
            </button>
          </div>
        </div>
      )}

      {selected.isMember && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 py-3 text-center text-sm font-bold text-amber-400">
          You are a member of this nation
        </div>
      )}
    </div>
  );
}
