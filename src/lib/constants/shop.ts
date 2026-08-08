// src/lib/constants/shop.ts
/**
 * Shop items (paid in in-game $WARDOG / $WARCAT).
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

import type { GiftBoxId } from "./gifts";
import { GIFT_BOXES } from "./gifts";
import type { PaidActionId } from "./payments";

export const SHOP_ITEMS = {
  energyPack: {
    id: "energyPack" as const,
    name: "Energy Pack",
    desc: "+100 energy instantly",
    cost: 0.55,
    energy: 100,
  },
  gloryBoost: {
    id: "gloryBoost" as const,
    name: "2× Glory Boost",
    desc: "Doubles merge glory for 6 minutes",
    cost: 0.95,
    durationMs: 6 * 60 * 1000,
  },
  nukePack: {
    id: "nukePack" as const,
    name: "Strategic Nuke",
    desc: "+1 Strategic Nuke (launch against any nation · unlimited)",
    cost: 1.7,
  },

  gift_common: {
    id: "gift_common" as const,
    name: GIFT_BOXES.common.name,
    desc: GIFT_BOXES.common.desc,
    cost: GIFT_BOXES.common.shopCost,
    giftId: "common" as GiftBoxId,
  },
  gift_wardog: {
    id: "gift_wardog" as const,
    name: GIFT_BOXES.wardog.name,
    desc: GIFT_BOXES.wardog.desc,
    cost: GIFT_BOXES.wardog.shopCost,
    giftId: "wardog" as GiftBoxId,
  },
  gift_warcat: {
    id: "gift_warcat" as const,
    name: GIFT_BOXES.warcat.name,
    desc: GIFT_BOXES.warcat.desc,
    cost: GIFT_BOXES.warcat.shopCost,
    giftId: "warcat" as GiftBoxId,
  },
  gift_nuke: {
    id: "gift_nuke" as const,
    name: GIFT_BOXES.nuke.name,
    desc: GIFT_BOXES.nuke.desc,
    cost: GIFT_BOXES.nuke.shopCost,
    giftId: "nuke" as GiftBoxId,
  },
  gift_legendary: {
    id: "gift_legendary" as const,
    name: GIFT_BOXES.legendary.name,
    desc: GIFT_BOXES.legendary.desc,
    cost: GIFT_BOXES.legendary.shopCost,
    giftId: "legendary" as GiftBoxId,
  },
} as const;

export type ShopItemId = keyof typeof SHOP_ITEMS;

export const SHOP_ACTION: Record<ShopItemId, PaidActionId> = {
  energyPack: "shop:energyPack",
  gloryBoost: "shop:gloryBoost",
  nukePack: "shop:nukePack",
  gift_common: "shop:gift_common",
  gift_wardog: "shop:gift_wardog",
  gift_warcat: "shop:gift_warcat",
  gift_nuke: "shop:gift_nuke",
  gift_legendary: "shop:gift_legendary",
};
