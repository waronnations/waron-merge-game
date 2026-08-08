// src/hooks/game-handlers/use-economy-handlers.ts
import { useCallback } from "react";
import { toast } from "sonner";
import { purchaseShopItem, recoverEnergy } from "@/lib/game.functions";
import { haptic } from "@/lib/telegram";
import { track } from "@/lib/analytics";
import { type GameState, type useGame, SHOP_ITEMS } from "@/lib/game-state";
import { type PayToken, formatReason } from "@/hooks/game-handlers/helpers";

function tokenLabel(payWith: PayToken): string {
  return payWith === "wardog" ? "$WARDOG" : "$WARCAT";
}

function spendErrorToast(reason: string | undefined, payWith: PayToken) {
  if (reason === "insufficient_spendable") {
    toast.error(
      `Not enough spendable ${tokenLabel(payWith)} — use Top up in Claim Center`,
      { duration: 2200 },
    );
    return;
  }
  if (reason === "insufficient_tokens" || reason === "no_tokens") {
    toast.error(
      `Not enough ${tokenLabel(payWith)} (spendable + claimable). Top up or earn more.`,
      { duration: 2000 },
    );
    return;
  }
  if (reason === "energy_full") {
    toast.error("Energy is already full", { duration: 1400 });
    return;
  }
  if (reason === "payment_required") {
    toast.error("Wallet authorization required");
    return;
  }
  if (reason === "no_progress") {
    toast.error("Syncing progress — try again");
    return;
  }
  toast.error(formatReason(reason) || "Action failed");
}

export function useEconomyHandlers({
  game,
  authenticated,
  pullFromServer,
  forceSync,
}: {
  game: ReturnType<typeof useGame>;
  authenticated: boolean;
  pullFromServer: () => Promise<unknown>;
  forceSync: () => Promise<unknown>;
}) {
  /**
   * Board energy recover.
   * Server: healthy treasury → playable then spendable; strained → spendable only.
   */
  const handleRecoverEnergy = useCallback(
    (payWith: PayToken = "wardog") => {
      // Skip optimistic local debit when authenticated — server owns spendable rules
      if (!authenticated) {
        const local = game.recoverEnergy?.(payWith) ?? game.recoverEnergy?.();
        if (local && typeof local === "object" && "ok" in local && !local.ok) {
          if ((local as { reason?: string }).reason === "no_tokens") {
            toast.error(`Not enough ${tokenLabel(payWith)}`, { duration: 1400 });
          }
          return;
        }
        if (local && typeof local === "object" && "ok" in local && local.ok) {
          haptic("medium");
        }
        void forceSync();
        return;
      }

      void (async () => {
        try {
          const res = await recoverEnergy({ data: { payWith } });
          if (!res.ok) {
            if (
              res.reason === "energy_full" ||
              res.reason === "no_tokens" ||
              res.reason === "insufficient_spendable" ||
              res.reason === "no_progress"
            ) {
              void pullFromServer();
            }
            spendErrorToast(res.reason, payWith);
            return;
          }
          if (res.state) {
            game.hydrate({
              energy: res.state.energy,
              wardogTokens: res.state.wardogTokens,
              warcatTokens: res.state.warcatTokens,
              lastRegenAt: res.state.lastRegenAt ?? Date.now(),
            });
          }
          track("energy_recover", { payWith });
          haptic("medium");
          void forceSync();
        } catch {
          toast.error("Energy recover failed");
        }
      })();
    },
    [game, authenticated, pullFromServer, forceSync],
  );

  /** Shop — server debits spendable first (see shop.server.ts). */
  const handleShopBuy = async (
    itemId: keyof typeof SHOP_ITEMS,
    payWith: PayToken = "wardog",
  ) => {
    if (!authenticated) {
      toast.error("Open in Telegram to buy");
      return;
    }
    try {
      const res = await purchaseShopItem({ data: { itemId, payWith } });
      if (!res.ok) {
        if (
          res.reason === "insufficient_tokens" ||
          res.reason === "insufficient_spendable" ||
          res.reason === "no_progress"
        ) {
          void pullFromServer();
        }
        spendErrorToast(res.reason, payWith);
        return;
      }

      if (res.state) {
        game.applyServerEconomy({
          energy: res.state.energy,
          wardogTokens: res.state.wardogTokens,
          warcatTokens: res.state.warcatTokens,
          lastRegenAt: res.state.lastRegenAt ?? Date.now(),
          nukesOwned: res.state.nukesOwned,
          gloryBoostUntil: (res.state as GameState).gloryBoostUntil,
        });
      }

      track("shop_purchase", { itemId, payWith });
      toast.success(
        `Purchased with ${tokenLabel(payWith)}`,
        { duration: 1400 },
      );
      haptic("medium");
    } catch {
      toast.error("Purchase failed");
    }
  };

  return { handleRecoverEnergy, handleShopBuy };
}
