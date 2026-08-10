// src/lib/game/types.ts
// Pure type definitions for the client game state. No runtime imports.
import type { Faction } from "@/lib/units";
import type { GiftBoxId } from "@/lib/constants/gifts";
import type { ExplosionColor } from "@/lib/constants";

export interface Cell {
  id: number;
  faction: Faction | "hybrid";
  tier: number;
  /** Visual unit line within the tier (0–2). Same variant required to merge. */
  variant?: number;
  parentDogId?: number;
  parentCatId?: number;
  isHybrid?: boolean;
  seed?: string;
  imageUrl?: string;
}

export interface HybridNFT {
  id: number;
  seed: string;
  parentDogId: number;
  parentCatId: number;
  createdAt: number;
  minted: boolean;
  imagePrompt: string;
  imageUrl?: string;
}

export interface PendingHybrid {
  id: number;
  parentDogId: number;
  parentCatId: number;
  from: number;
  to: number;
}

export interface GameState {
  board: (Cell | null)[];
  nextId: number;
  glory: number;
  energy: number;
  lastRegenAt: number;
  totalMerges: number;
  highestTier: number;
  lastDailyClaim: number;
  dailyStreak: number;
  wardogTokens: number;
  warcatTokens: number;
  referralCode: string;
  referrals: any[]; // keep existing type
  invitedBy?: string;
  hasSeenTutorial: boolean;
  gloryBoostUntil: number;
  lastSeenAt: number;
  pendingIdleReward: any | null;
  nukesUsedToday: number;
  lastNukeDay: number;
  pendingHybrid: PendingHybrid | null;
  hybrids: HybridNFT[];

  explosion: {
    idx: number;
    color: ExplosionColor;
    key: number;
  } | null;

  lastMergeAt?: number;
  comboCount?: number;
  achievements?: string[];

  nukesOwned?: number;
  nukesLaunchedToday?: number;
  totalNukesLaunched?: number;
  isTerrorist?: boolean;
  lastNukeTargetId?: number | null;

  /** Inventory of unopened gift boxes */
  giftBoxes?: Partial<Record<GiftBoxId, number>>;

  // ── NEW: Board Conquer system ────────────────────────────────
  /** Left half (cols 0-2) is fully occupied by hybrids */
  dogSideConquered: boolean;
  /** Right half (cols 3-5) is fully occupied by hybrids */
  catSideConquered: boolean;
}
