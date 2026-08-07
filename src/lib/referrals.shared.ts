/** Client-safe referral constants and types (no DB access). */

export const REFERRAL_BOT = "waronnationsgamebot";

/** Recruit must meet at least one of these to count toward milestones. */
export const REFERRAL_QUALIFY_MIN_MERGES = 3;
export const REFERRAL_QUALIFY_MIN_GLORY = 80;

export interface MilestoneReward {
  glory: number;
  wardog: number;
  warcat: number;
}

export interface Milestone {
  threshold: number;
  bit: number;
  reward: MilestoneReward;
}

/**
 * Wire order defines bit indices — do not reorder.
 * First milestone is more generous to make sharing feel rewarding immediately.
 */
export const MILESTONES: Milestone[] = [
  { threshold: 1, bit: 1 << 0, reward: { glory: 800, wardog: 8, warcat: 8 } },
  { threshold: 3, bit: 1 << 1, reward: { glory: 2_000, wardog: 18, warcat: 18 } },
  { threshold: 5, bit: 1 << 2, reward: { glory: 4_000, wardog: 35, warcat: 35 } },
  { threshold: 10, bit: 1 << 3, reward: { glory: 10_000, wardog: 80, warcat: 80 } },
  { threshold: 25, bit: 1 << 4, reward: { glory: 30_000, wardog: 220, warcat: 220 } },
  { threshold: 50, bit: 1 << 5, reward: { glory: 75_000, wardog: 550, warcat: 550 } },
  {
    threshold: 100,
    bit: 1 << 6,
    reward: { glory: 200_000, wardog: 1_200, warcat: 1_200 },
  },
];

export interface RecentRecruit {
  name: string;
  joinedAt: number;
  /** True if this recruit met the quality gate. */
  qualified: boolean;
}

export interface ReferralStatusPayload {
  code: string;
  botUrl: string;
  /** Qualified recruits only (used for milestones). */
  referralCount: number;
  /** Total referred users including unqualified. */
  rawReferralCount: number;
  claimedBitmap: number;
  recentRecruits: RecentRecruit[];
  milestones: Array<{
    threshold: number;
    reward: MilestoneReward;
    claimed: boolean;
    claimable: boolean;
  }>;
  qualify: {
    minMerges: number;
    minGlory: number;
  };
}

/**
 * Single source of truth for every referral deep-link.
 * Always use startapp (not start) so the Mini App receives the parameter.
 */
export function buildReferralLink(code: string): string {
  return `https://t.me/${REFERRAL_BOT}?startapp=${code}`;
}

/** Share text for Telegram / native share */
export function buildReferralShareText(code: string): string {
  const link = buildReferralLink(code);
  return (
    `⚔️ Join me in War On Nations!\n` +
    `Merge WARDOG & WARCAT, claim countries, climb ranks.\n\n` +
    `Use my link and we both get rewards:\n${link}`
  );
}
