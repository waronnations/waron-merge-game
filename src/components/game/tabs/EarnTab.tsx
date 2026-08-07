// src/components/game/tabs/EarnTab.tsx
import { ShoppingBag, Wallet, Users } from "lucide-react";
import { TabHero } from "@/components/game/TabHero";
import { SubTabBar } from "@/components/game/SubTabBar";
import { ShopPanel } from "@/components/ShopPanel";
import {
  ClaimPanel,
  type ClaimBalanceSyncPayload,
} from "@/components/ClaimPanel";
import { ReferralPanel } from "@/components/Panels";
import { type useGame, SHOP_ITEMS } from "@/lib/game-state";

export type EarnSub = "shop" | "claim" | "recruit";
export type PayToken = "wardog" | "warcat";

export function EarnTab({
  earnSub,
  setEarnSub,
  game,
  authenticated,
  forceSync,
  onShopBuy,
}: {
  earnSub: EarnSub;
  setEarnSub: (v: EarnSub) => void;
  game: ReturnType<typeof useGame>;
  authenticated: boolean;
  forceSync: () => Promise<unknown>;
  onShopBuy: (
    itemId: keyof typeof SHOP_ITEMS,
    payWith: PayToken,
  ) => void | Promise<void>;
}) {
  const { state } = game;

  /**
   * After a claim, ClaimPanel reports *spendable* balances
   * (total − claimed). Patch local game state so TopBar + BASE
   * match the claim vault. Do NOT forceSync immediately — that
   * would re-load lifetime wardog_tokens / warcat_tokens and undo
   * the spendable display.
   */
  const handleClaimBalanceSync = (payload: ClaimBalanceSyncPayload) => {
    game.applyServerEconomy({
      wardogTokens: payload.wardogTokens,
      warcatTokens: payload.warcatTokens,
    });
  };

  return (
    <>
      <TabHero tab="earn" />
      <SubTabBar
        tabs={[
          { id: "shop" as const, label: "Shop", icon: ShoppingBag },
          { id: "claim" as const, label: "Claim", icon: Wallet },
          { id: "recruit" as const, label: "Recruit", icon: Users },
        ]}
        value={earnSub}
        onChange={setEarnSub}
      />
      {earnSub === "shop" && <ShopPanel state={state} onBuy={onShopBuy} />}
      {earnSub === "claim" && (
        <ClaimPanel
          state={state}
          authenticated={authenticated}
          onBalanceSync={handleClaimBalanceSync}
        />
      )}
      {earnSub === "recruit" && (
        <ReferralPanel
          state={state}
          authenticated={authenticated}
          onCodeSync={(code) => game.hydrate({ ...state, referralCode: code })}
          onServerReward={(json) => {
            try {
              const parsed = JSON.parse(json) as typeof state;
              game.applyServerState(parsed);
              void forceSync();
            } catch {
              /* ignore */
            }
          }}
        />
      )}
    </>
  );
}
