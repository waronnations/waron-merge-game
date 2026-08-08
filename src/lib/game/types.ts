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

export interface Task {
  id: string;
  title: string;
  desc: string;
  reward: number;
  wardog?: number;
  warcat?: number;
  done: boolean;
  claimed: boolean;
}

export interface DailyQuest {
  id: string;
  title: string;
  desc: string;
  target: number;
  progress: number;
  reward: number;
  wardog?: number;
  warcat?: number;
  energy?: number;
  claimed: boolean;
}

export interface Referral {
  code: string;
  name: string;
  joinedAt: number;
  glory: number;
}

export interface IdleReward {
  glory: number;
  energy: number;
  wardog: number;
  warcat: number;
  minutes: number;
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
  tasks: Task[];
  dailyQuests: DailyQuest[];
  dailyQuestsDate: number;
  wardogTokens: number;
  warcatTokens: number;
  referralCode: string;
  referrals: Referral[];
  invitedBy?: string;
  hasSeenTutorial: boolean;
  gloryBoostUntil: number;
  lastSeenAt: number;
  pendingIdleReward: IdleReward | null;
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
}

export interface MergeResult {
  ok: boolean;
  token?: "wardog" | "warcat";
  amount?: number;
  isHybrid?: boolean;
  combo?: number;
  comboMult?: number;
  unlocked?: string[];
  gloryGained?: number;
  variantPerfect?: boolean;
}
