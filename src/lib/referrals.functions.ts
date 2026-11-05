import { createServerFn } from "@tanstack/react-start";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import {
  ClaimInput,
  claimMilestone,
  loadReferralStatus,
  requireUserId,
  type ClaimMilestoneResult,
} from "@/lib/referrals.server";
import type { ReferralStatusPayload } from "@/lib/referrals.shared";

export {
  MILESTONES,
  REFERRAL_BOT,
  buildReferralLink,
  buildReferralShareText,
  type Milestone,
  type MilestoneReward,
  type RecentRecruit,
  type ReferralStatusPayload,
} from "@/lib/referrals.shared";

export const getReferralStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReferralStatusPayload | { error: string }> => {
    if (!hasDatabase()) return { error: "database_unavailable" };
    await ensureSchema();
    return loadReferralStatus(await requireUserId());
  },
);

export const claimReferralMilestone = createServerFn({ method: "POST" })
  .validator((input: unknown) => ClaimInput.parse(input))
  .handler(async ({ data }): Promise<ClaimMilestoneResult> => {
    if (!hasDatabase()) return { ok: false, error: "database_unavailable" };
    await ensureSchema();
    return claimMilestone(await requireUserId(), data.threshold);
  });
