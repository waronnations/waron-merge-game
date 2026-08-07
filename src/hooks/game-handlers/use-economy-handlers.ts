// src/hooks/game-handlers/use-economy-handlers.ts
import { useCallback } from "react";
import { toast } from "sonner";
import { purchaseShopItem, recoverEnergy } from "@/lib/game.functions";
import { haptic } from "@/lib/telegram";
import { track } from "@/lib/analytics";
import { type GameState, type useGame, SHOP_ITEMS } from "@/lib/game-state";
import { type PayToken, formatReason } from "@/hooks/game-handlers/helpers";

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
   * Board energy recover — playable $WARDOG or $WARCAT only.
   * No wallet. Claimed tokens stay locked on the server.
   */
  const handleRecoverEnergy = useCallback(
    (payWith: PayToken = "wardog") => {
      const local = game.recoverEnergy?.(payWith) ?? game.recoverEnergy?.();
      // Prefer local optimistic if game-state supports payWith; else server-only
      if (local && typeof local === "object" && "ok" in local && !local.ok) {
        if ((local as { reason?: string }).reason === "no_tokens") {
          toast.error(
            payWith === "wardog" ? "Not enough $WARDOG" : "Not enough $WARCAT",
            { duration: 1400 },
          );
        }
        return;
      }

      if (local && typeof local === "object" && "ok" in local && local.ok) {
        haptic("medium");
      }

      if (authenticated) {
        void (async () => {
          try {
            const res = await recoverEnergy({ data: { payWith } });
            if (!res.ok) {
              if (
                res.reason === "energy_full" ||
                res.reason === "no_tokens" ||
                res.reason === "no_progress"
              ) {
                void pullFromServer();
              }
              if (res.reason === "no_tokens") {
                toast.error(
                  payWith === "wardog"
                    ? "Not enough playable $WARDOG"
                    : "Not enough playable $WARCAT",
                  { duration: 1400 },
                );
              }
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
            void forceSync();
          } catch {
            /* local already applied when available */
          }
        })();
      } else {
        void forceSync();
      }
    },
    [game, authenticated, pullFromServer, forceSync],
  );

  /** Shop spend — server deducts chosen playable token (wallet gated in ShopPanel). */
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
          res.reason === "no_progress"
        ) {
          void pullFromServer();
        }
        toast.error(
          res.reason === "insufficient_tokens"
            ? payWith === "wardog"
              ? "Not enough playable $WARDOG"
              : "Not enough playable $WARCAT"
            : res.reason === "payment_required"
              ? "Wallet authorization required"
              : res.reason === "no_progress"
                ? "Syncing progress — try again"
                : formatReason(res.reason) || "Purchase failed",
        );
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
        `Purchased with $${payWith === "wardog" ? "WARDOG" : "WARCAT"}`,
        { duration: 1400 },
      );
      haptic("medium");
    } catch {
      toast.error("Purchase failed");
    }
  };

  return { handleRecoverEnergy, handleShopBuy };
}
