// src/lib/constants/nations.ts
/**
 * Nations: leadership, buffs, protection, traitors, reputation, factions.
 * Part of the @/lib/constants barrel — import from "@/lib/constants".
 */

// ── Factions (country alignment after claim) ───────────────────
export type NationFaction = "wardog" | "warcat";

export const NATION_FACTIONS: NationFaction[] = ["wardog", "warcat"];

/** 50/50 random alignment when a country is first claimed */
export function randomNationFaction(): NationFaction {
  return Math.random() < 0.5 ? "wardog" : "warcat";
}

export function factionLabel(faction: NationFaction | null | undefined): string {
  if (faction === "wardog") return "WARDOG";
  if (faction === "warcat") return "WARCAT";
  return "Unaligned";
}

// ── Nations ────────────────────────────────────────────────────
export const NATION_LEADER_MIN_TENURE_HOURS = 24;
export const TRAITOR_CANNOT_CLAIM_EMPTY = true;
export const TRAITOR_GLORY_CONTRIBUTION = 0.6;
export const MAX_OFFICERS = 3;

export const WEEKLY_GLORY_ROLE_MULT = {
  leader: 1.35,
  officer: 1.15,
  member: 1.0,
} as const;

export const NATION_INVITE_REWARD = {
  glory: 150,
  wardog: 0.5,
  warcat: 0.5,
  /** Reputation granted to the nation the invited player joined */
  nationRep: 10,
} as const;

/** Reputation points granted for various nation actions */
export const BUFF_ACTIVATION_REP = 8;
export const PROTECTION_ACTIVATION_REP = 12;
export const VAULT_DONATION_REP = 5;

export const NATION_BUFFS = {
  gloryBoost: {
    id: "gloryBoost" as const,
    name: "War Footing",
    desc: "All members gain +25% glory for 60 minutes",
    costWardog: 8,
    costWarcat: 8,
    durationMs: 60 * 60 * 1000,
    gloryMult: 1.25,
  },
  energySurge: {
    id: "energySurge" as const,
    name: "Supply Drop",
    desc: "All current members instantly gain +30 energy",
    costWardog: 5,
    costWarcat: 5,
    durationMs: 0,
    energyGrant: 30,
  },
  mergeFrenzy: {
    id: "mergeFrenzy" as const,
    name: "Merge Frenzy",
    desc: "Members gain +15% combo multiplier for 45 minutes",
    costWardog: 10,
    costWarcat: 10,
    durationMs: 45 * 60 * 1000,
    comboMult: 1.15,
  },
  shieldWall: {
    id: "shieldWall" as const,
    name: "Shield Wall",
    desc: "Nation takes 40% less nuke damage for 90 minutes",
    costWardog: 12,
    costWarcat: 12,
    durationMs: 90 * 60 * 1000,
    nukeResist: 0.4,
  },
} as const;

export type NationBuffId = keyof typeof NATION_BUFFS;

// ── Phase 1: Nation Protection & Economy ───────────────────────
export const NATION_PROTECTION_DURATION_MS = 24 * 60 * 60 * 1000;

export const NATION_PROTECTION_COST = {
  wardog: 25,
  warcat: 25,
} as const;

export const DEFAULT_PROTECTED_JOIN_CONTRIBUTION = {
  wardog: 2,
  warcat: 2,
} as const;

export const DEFAULT_REDEMPTION_PRICE = {
  wardog: 15,
  warcat: 15,
} as const;

export const TRAITOR_COOLDOWN_DAYS = 7;

export const MAX_REDEMPTION_PRICE = {
  wardog: 200,
  warcat: 200,
} as const;

/**
 * Reputation tiers for UI.
 * IMPORTANT: "Recruit" is low reputation — NOT "empty / unclaimed".
 * Claim status must use memberCount / canClaim, never this label.
 */
export function getReputationTier(score: number) {
  if (score >= 800)
    return {
      tier: "Legendary",
      color: "text-amber-300",
      bg: "bg-amber-950/40 border-amber-500/40",
    };
  if (score >= 350)
    return {
      tier: "Powerful",
      color: "text-purple-300",
      bg: "bg-purple-950/40 border-purple-500/40",
    };
  if (score >= 120)
    return {
      tier: "Established",
      color: "text-blue-300",
      bg: "bg-blue-950/40 border-blue-500/40",
    };
  if (score >= 40)
    return {
      tier: "Rising",
      color: "text-emerald-300",
      bg: "bg-emerald-950/40 border-emerald-500/40",
    };
  return {
    tier: "Recruit",
    color: "text-zinc-400",
    bg: "bg-zinc-900 border-zinc-700",
  };
}
