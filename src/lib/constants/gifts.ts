// src/lib/constants/gifts.ts
/**
 * Gift box system – single source of truth.
 * All economy actions that grant/open boxes stay server-authoritative.
 */

export type GiftBoxId =
  | "common"
  | "wardog"
  | "warcat"
  | "nuke"
  | "legendary";

export interface GiftBoxDef {
  id: GiftBoxId;
  name: string;
  desc: string;
  closedImg: string;
  openImg: string;
  shopCost: number;
  rewards: {
    glory: [number, number];
    wardog: [number, number];
    warcat: [number, number];
    energy: [number, number];
    nukeChance?: number;
  };
}

export const GIFT_BOXES: Record<GiftBoxId, GiftBoxDef> = {
  common: {
    id: "common",
    name: "Ops Supply Crate",
    desc: "Standard daily ops drop. Small glory, tokens & energy.",
    closedImg: "/images/gifts/gift_common_01_closed.png",
    openImg: "/images/gifts/gift_ops_open_01.png",
    shopCost: 0.5,
    rewards: {
      glory: [40, 120],
      wardog: [0.05, 0.25],
      warcat: [0.05, 0.25],
      energy: [8, 25],
    },
  },
  wardog: {
    id: "wardog",
    name: "WARDOG War Chest",
    desc: "Faction supply. Extra $WARDOG + glory.",
    closedImg: "/images/gifts/gift_wardog_01.png",
    openImg: "/images/gifts/gift_burst_01.png",
    shopCost: 1.2,
    rewards: {
      glory: [80, 200],
      wardog: [0.3, 0.9],
      warcat: [0.05, 0.2],
      energy: [15, 40],
    },
  },
  warcat: {
    id: "warcat",
    name: "WARCAT Stealth Chest",
    desc: "Faction supply. Extra $WARCAT + glory.",
    closedImg: "/images/gifts/gift_warcat_01.png",
    openImg: "/images/gifts/gift_burst_02.png",
    shopCost: 1.2,
    rewards: {
      glory: [80, 200],
      wardog: [0.05, 0.2],
      warcat: [0.3, 0.9],
      energy: [15, 40],
    },
  },
  nuke: {
    id: "nuke",
    name: "Nuclear Special",
    desc: "High-risk drop. Chance of +1 Strategic Nuke.",
    closedImg: "/images/gifts/gift_nuke_01.png",
    openImg: "/images/gifts/gift_burst_03.png",
    shopCost: 2.0,
    rewards: {
      glory: [150, 350],
      wardog: [0.4, 1.2],
      warcat: [0.4, 1.2],
      energy: [30, 70],
      nukeChance: 0.35,
    },
  },
  legendary: {
    id: "legendary",
    name: "Warlord Legendary Chest",
    desc: "Top-tier. Big rewards + higher nuke chance.",
    closedImg: "/images/gifts/gift_legendary_01.png",
    openImg: "/images/gifts/gift_ops_open_02.png",
    shopCost: 4.5,
    rewards: {
      glory: [400, 900],
      wardog: [1.0, 2.5],
      warcat: [1.0, 2.5],
      energy: [50, 120],
      nukeChance: 0.55,
    },
  },
} as const;

export const GIFT_CLOSED_VARIANTS: Record<GiftBoxId, string[]> = {
  common: [
    "/images/gifts/gift_common_01_closed.png",
    "/images/gifts/gift_common_02_closed.png",
    "/images/gifts/gift_common_03_closed.png",
  ],
  wardog: [
    "/images/gifts/gift_wardog_01.png",
    "/images/gifts/gift_wardog_02.png",
    "/images/gifts/gift_wardog_03.png",
  ],
  warcat: [
    "/images/gifts/gift_warcat_01.png",
    "/images/gifts/gift_warcat_02.png",
    "/images/gifts/gift_warcat_03.png",
  ],
  nuke: [
    "/images/gifts/gift_nuke_01.png",
    "/images/gifts/gift_nuke_02.png",
  ],
  legendary: [
    "/images/gifts/gift_legendary_01.png",
    "/images/gifts/gift_legendary_02.png",
  ],
};

export const GIFT_BURST_IMAGES = [
  "/images/gifts/gift_burst_01.png",
  "/images/gifts/gift_burst_02.png",
  "/images/gifts/gift_burst_03.png",
  "/images/gifts/gift_ops_open_01.png",
  "/images/gifts/gift_ops_open_02.png",
] as const;
