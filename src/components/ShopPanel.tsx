// src/components/ShopPanel.tsx
/**
 * Shop — white-on-black · colored writings only
 * All shop items (incl. energyPack): topped-up spendable only
 * Merge board: energy only
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Flame,
  Bomb,
  ShoppingCart,
  RefreshCw,
  Wallet,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import type { GameState } from "@/lib/game-state";
import { SHOP_ITEMS, SHOP_ACTION, type ShopItemId } from "@/lib/constants";
import { GIFT_BOXES } from "@/lib/constants/gifts";
import { haptic } from "@/lib/telegram";
import { listNationsFn, buyNationFn } from "@/lib/nations.functions";
import { usePayments } from "@/components/payments/PaymentProvider";

export type PayToken = "wardog" | "warcat";

type ListedNation = {
  id: number;
  name: string;
  tag: string;
  emblem?: string | null;
  listedPrice: number | null;
  memberCount: number;
  isDefault?: boolean;
};

const POWERUP_IDS: ShopItemId[] = ["energyPack", "gloryBoost", "nukePack"];
const GIFT_IDS: ShopItemId[] = [
  "gift_common",
  "gift_wardog",
  "gift_warcat",
  "gift_nuke",
  "gift_legendary",
];

const ITEM_META: Record<
  string,
  { icon?: typeof Zap; img?: string }
> = {
  energyPack: { icon: Zap },
  gloryBoost: { icon: Flame },
  nukePack: { icon: Bomb },
  gift_common: { img: GIFT_BOXES.common.closedImg },
  gift_wardog: { img: GIFT_BOXES.wardog.closedImg },
  gift_warcat: { img: GIFT_BOXES.warcat.closedImg },
  gift_nuke: { img: GIFT_BOXES.nuke.closedImg },
  gift_legendary: { img: GIFT_BOXES.legendary.closedImg },
};

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function ShopPanel({
  state,
  onBuy,
  spendableWardog = 0,
  spendableWarcat = 0,
  claimedWardog = 0,
  claimedWarcat = 0,
}: {
  state: GameState;
  onBuy: (itemId: ShopItemId, payWith: PayToken) => Promise<void> | void;
  spendableWardog?: number;
  spendableWarcat?: number;
  claimedWardog?: number;
  claimedWarcat?: number;
}) {
  const { pay, connected, address, disconnectWallet } = usePayments();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [listed, setListed] = useState<ListedNation[]>([]);
  const [loadingNations, setLoadingNations] = useState(true);
  const [buyingKey, setBuyingKey] = useState<string | null>(null);

  const totalW = Number(state.wardogTokens ?? 0);
  const totalC = Number(state.warcatTokens ?? 0);
  const playableW = Math.max(0, totalW - Number(claimedWardog ?? 0));
  const playableC = Math.max(0, totalC - Number(claimedWarcat ?? 0));

  const loadMarketplace = async () => {
    setLoadingNations(true);
    try {
      const list = await listNationsFn();
      setListed(
        (list as ListedNation[]).filter(
          (n) =>
            !n.isDefault &&
            n.listedPrice != null &&
            Number(n.listedPrice) > 0,
        ),
      );
    } catch {
      /* silent */
    } finally {
      setLoadingNations(false);
    }
  };

  useEffect(() => {
    void loadMarketplace();
  }, []);

  const balanceForItem = useMemo(() => {
    return (_itemId: ShopItemId, payWith: PayToken) =>
      payWith === "wardog" ? spendableWardog : spendableWarcat;
  }, [spendableWardog, spendableWarcat]);

  const handleShopBuy = async (itemId: ShopItemId, payWith: PayToken) => {
    if (busyKey) return;
    const item = SHOP_ITEMS[itemId];
    const balance = balanceForItem(itemId, payWith);

    if (balance < item.cost - 0.001) {
      toast.error(
        payWith === "wardog"
          ? "Not enough topped-up $WARDOG — use Top Up"
          : "Not enough topped-up $WARCAT — use Top Up",
      );
      return;
    }

    setBusyKey(`${itemId}:${payWith}`);
    try {
      const auth = await pay(SHOP_ACTION[itemId]);
      if (!auth.ok) {
        if (auth.reason !== "cancelled") {
          toast.error("Wallet authorization required");
        }
        return;
      }
      await onBuy(itemId, payWith);
      haptic("heavy");
      toast.success(`${item.name} purchased!`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("insufficient_spendable") ||
        msg.includes("insufficient_playable")
      ) {
        toast.error("Need topped-up balance — use Top Up");
      } else {
        toast.error("Purchase failed");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleBuyNation = async (nation: ListedNation, payWith: PayToken) => {
    if (buyingKey || !nation.listedPrice) return;
    const price = Number(nation.listedPrice);
    const balance = payWith === "wardog" ? spendableWardog : spendableWarcat;

    if (balance < price - 0.001) {
      toast.error(
        payWith === "wardog"
          ? "Not enough topped-up $WARDOG — use Top Up"
          : "Not enough topped-up $WARCAT — use Top Up",
      );
      return;
    }

    const key = `${nation.id}:${payWith}`;
    setBuyingKey(key);
    try {
      const auth = await pay("nation:buy");
      if (!auth.ok) {
        if (auth.reason !== "cancelled") {
          toast.error("Wallet authorization required");
        }
        return;
      }
      await buyNationFn({ data: { nationId: nation.id, payWith } });
      toast.success(
        `Bought ${nation.name} with $${payWith === "wardog" ? "WARDOG" : "WARCAT"}`,
      );
      haptic("heavy");
      await loadMarketplace();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (
        msg.includes("insufficient_tokens") ||
        msg.includes("insufficient_spendable")
      ) {
        toast.error("Need topped-up balance — use Top Up");
      } else if (msg.includes("not_for_sale")) {
        toast.error("No longer for sale");
      } else if (msg.includes("must_leave_current_nation")) {
        toast.error("Leave your current nation first");
      } else {
        toast.error("Purchase failed");
      }
    } finally {
      setBuyingKey(null);
    }
  };

  const renderItem = (id: ShopItemId) => {
    const item = SHOP_ITEMS[id];
    const meta = ITEM_META[id] || {};
    const balW = balanceForItem(id, "wardog");
    const balC = balanceForItem(id, "warcat");

    return (
      <motion.div
        key={id}
        layout
        className="rounded-2xl border border-zinc-700 bg-zinc-900 p-3.5"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-black/50 text-white">
            {meta.img ? (
              <img
                src={meta.img}
                alt={item.name}
                className="h-9 w-9 object-contain"
              />
            ) : meta.icon ? (
              <meta.icon className="h-5 w-5" />
            ) : (
              <Gift className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-white">{item.name}</div>
            <div className="text-xs text-zinc-400">{item.desc}</div>
            <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-zinc-500">
              Cost · {item.cost} ·{" "}
              <span className="text-white">topped-up only</span>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!!busyKey || balW < item.cost - 0.001}
            onClick={() => void handleShopBuy(id, "wardog")}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-600 bg-zinc-950 py-2.5 text-[0.7rem] font-black uppercase tracking-wider text-red-300 disabled:opacity-40"
          >
            {busyKey === `${id}:wardog` ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            $WARDOG · {item.cost}
          </button>
          <button
            type="button"
            disabled={!!busyKey || balC < item.cost - 0.001}
            onClick={() => void handleShopBuy(id, "warcat")}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-600 bg-zinc-950 py-2.5 text-[0.7rem] font-black uppercase tracking-wider text-violet-300 disabled:opacity-40"
          >
            {busyKey === `${id}:warcat` ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            $WARCAT · {item.cost}
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2.5 text-[0.65rem] leading-relaxed text-zinc-400">
        <div className="mb-1 font-black uppercase tracking-wider text-white">
          Token pools
        </div>
        <div>
          Unclaimed <span className="text-zinc-500">(claim only)</span>:{" "}
          <span className="text-white">
            {fmt(playableW)} $WARDOG · {fmt(playableC)} $WARCAT
          </span>
        </div>
        <div>
          Topped-up{" "}
          <span className="text-zinc-500">(shop · energy · OPS)</span>:{" "}
          <span className="text-white">
            {fmt(spendableWardog)} $WARDOG · {fmt(spendableWarcat)} $WARCAT
          </span>
        </div>
        <div className="mt-1.5 text-zinc-500">
          Merge board spends energy only. Shop energy packs use topped-up
          balances — never unclaimed merge earnings.
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Wallet
            className={`h-4 w-4 shrink-0 ${connected ? "text-emerald-400" : "text-zinc-500"}`}
          />
          <div className="min-w-0">
            <div className="text-[0.65rem] font-black uppercase tracking-wider text-zinc-400">
              {connected ? "Wallet connected" : "Wallet required for shop"}
            </div>
            <div className="truncate font-mono text-[0.65rem] text-zinc-500">
              {connected && address
                ? `${address.slice(0, 6)}…${address.slice(-4)}`
                : "Connect when you buy — stays until you disconnect"}
            </div>
          </div>
        </div>
        {connected && (
          <button
            type="button"
            onClick={() => void disconnectWallet()}
            className="shrink-0 rounded-lg border border-zinc-600 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-zinc-400 hover:border-zinc-400 hover:text-white"
          >
            Disconnect
          </button>
        )}
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400">
        Shop energy & power-ups ·{" "}
        <span className="text-white">topped-up only</span> · merge board ·{" "}
        <span className="text-white">energy only</span> · unclaimed ·{" "}
        <span className="text-white">claimable</span>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500">
          <Zap className="h-3.5 w-3.5 text-white" />
          Board energy · topped-up
        </h3>
        <div className="space-y-3">{renderItem("energyPack")}</div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">
          Power-ups · topped-up
        </h3>
        <div className="space-y-3">
          {POWERUP_IDS.filter((id) => id !== "energyPack").map(renderItem)}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">
          Supply drops · topped-up
        </h3>
        <div className="space-y-3">{GIFT_IDS.map(renderItem)}</div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Nations for sale
          </h3>
          <button
            type="button"
            onClick={() => void loadMarketplace()}
            className="text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
          >
            Refresh
          </button>
        </div>
        {loadingNations ? (
          <div className="rounded-xl border border-zinc-800 py-8 text-center text-xs text-zinc-500">
            Loading marketplace…
          </div>
        ) : listed.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 py-8 text-center text-xs text-zinc-500">
            No nations listed right now
          </div>
        ) : (
          <div className="space-y-3">
            {listed.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-black/50 text-xl">
                    {n.emblem || "🏳️"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-white">
                      {n.name}
                    </div>
                    <div className="text-xs text-zinc-400">
                      [{n.tag}] · {n.memberCount} members · {n.listedPrice}{" "}
                      tokens
                    </div>
                  </div>
                  <ShoppingCart className="h-4 w-4 shrink-0 text-white" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={
                      !!buyingKey ||
                      spendableWardog < Number(n.listedPrice) - 0.001
                    }
                    onClick={() => void handleBuyNation(n, "wardog")}
                    className="rounded-xl border border-zinc-600 bg-zinc-950 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-red-300 disabled:opacity-40"
                  >
                    {buyingKey === `${n.id}:wardog`
                      ? "…"
                      : `$WARDOG · ${n.listedPrice}`}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !!buyingKey ||
                      spendableWarcat < Number(n.listedPrice) - 0.001
                    }
                    onClick={() => void handleBuyNation(n, "warcat")}
                    className="rounded-xl border border-zinc-600 bg-zinc-950 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-violet-300 disabled:opacity-40"
                  >
                    {buyingKey === `${n.id}:warcat`
                      ? "…"
                      : `$WARCAT · ${n.listedPrice}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-[0.6rem] leading-relaxed text-zinc-600">
        Shop & marketplace require topped-up $WARDOG / $WARCAT (use Top Up).
        Free merge-board earnings are claimable only. Never native TON.
      </p>
    </div>
  );
}
