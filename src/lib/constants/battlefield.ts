// src/lib/constants/battlefield.ts
/**
 * OPS Battlefield — knives, guns, PvP strikes.
 * Purchases use topped-up (spendable) balances only.
 * Taxes flow to ClaimTreasury via applyDynamicTax + recordTreasuryDeposit.
 */

export type BattlefieldWeaponId = "knife" | "pistol" | "rifle";

export type BattlefieldWeapon = {
  id: BattlefieldWeaponId;
  name: string;
  desc: string;
  /** Base cost in one token (wardog OR warcat) before dynamic tax */
  cost: number;
  /** Hit chance 0–1 */
  hitChance: number;
  /** Glory awarded to attacker on hit */
  gloryOnHit: number;
  /** Small token reward to attacker on hit (playable — claimable later) */
  tokenRewardOnHit: number;
  /** Glory taken from victim on hit (floored at 0) */
  gloryDrainOnHit: number;
  /** Energy drained from victim on hit */
  energyDrainOnHit: number;
  /** Seconds between uses of this weapon for one attacker */
  cooldownSec: number;
  emoji: string;
};

export const BATTLEFIELD_WEAPONS: Record<BattlefieldWeaponId, BattlefieldWeapon> = {
  knife: {
    id: "knife",
    name: "Combat Knife",
    desc: "Close range. Cheap. Moderate hit chance.",
    cost: 1.5,
    hitChance: 0.55,
    gloryOnHit: 8,
    tokenRewardOnHit: 0.15,
    gloryDrainOnHit: 4,
    energyDrainOnHit: 5,
    cooldownSec: 90,
    emoji: "🔪",
  },
  pistol: {
    id: "pistol",
    name: "Sidearm",
    desc: "Reliable mid-range strike.",
    cost: 4,
    hitChance: 0.7,
    gloryOnHit: 20,
    tokenRewardOnHit: 0.4,
    gloryDrainOnHit: 12,
    energyDrainOnHit: 10,
    cooldownSec: 180,
    emoji: "🔫",
  },
  rifle: {
    id: "rifle",
    name: "Assault Rifle",
    desc: "High impact. Expensive. Strong rewards.",
    cost: 12,
    hitChance: 0.85,
    gloryOnHit: 55,
    tokenRewardOnHit: 1.2,
    gloryDrainOnHit: 30,
    energyDrainOnHit: 20,
    cooldownSec: 420,
    emoji: "Rifle",
  },
};

/** Max attacks per attacker per UTC day (all weapons) */
export const BATTLEFIELD_DAILY_ATTACK_CAP = 40;

/** Cannot attack yourself */
export const BATTLEFIELD_MIN_TARGET_TELEGRAM_ID = 1;
