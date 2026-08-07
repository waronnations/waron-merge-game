// src/lib/constants/payments.ts
/**
 * Marketplace tax + wallet authorization actions.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

export const MARKETPLACE_TAX_RATE = 0.05;

export const PAID_ACTIONS = {
  "shop:energyPack": { label: "Energy Pack", ton: 0 },
  "shop:gloryBoost": { label: "2× Glory Boost", ton: 0 },
  "shop:nukePack": { label: "Strategic Nuke", ton: 0 },

  "shop:gift_common": { label: "Ops Supply Crate", ton: 0 },
  "shop:gift_wardog": { label: "WARDOG War Chest", ton: 0 },
  "shop:gift_warcat": { label: "WARCAT Stealth Chest", ton: 0 },
  "shop:gift_nuke": { label: "Nuclear Special", ton: 0 },
  "shop:gift_legendary": { label: "Warlord Legendary Chest", ton: 0 },

  "nation:protect": { label: "24h Nation Protection", ton: 0 },
  "nation:buff:gloryBoost": { label: "War Footing (nation buff)", ton: 0 },
  "nation:buff:energySurge": { label: "Supply Drop (nation buff)", ton: 0 },
  "nation:buff:mergeFrenzy": { label: "Merge Frenzy (nation buff)", ton: 0 },
  "nation:buff:shieldWall": { label: "Shield Wall (nation buff)", ton: 0 },
  "nation:buy": { label: "Nation Purchase", ton: 0 },
  "nation:redeem": { label: "Traitor Redemption", ton: 0 },
} as const;

export type PaidActionId = keyof typeof PAID_ACTIONS;

export const PAYMENT_INTENT_TTL_MS = 15 * 60 * 1000;
export const MAX_PAYMENT_INTENTS_PER_MIN = 8;
