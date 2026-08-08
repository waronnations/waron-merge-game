/** Server-only referral logic. Imported by referrals.functions.ts handlers. */

import { z } from "zod";
import { sql } from "@/lib/db.server";
import { readSession } from "@/lib/session.server";
import {
  MILESTONES,
  REFERRAL_QUALIFY_MIN_GLORY,
  REFERRAL_QUALIFY_MIN_MERGES,
  buildReferralLink,
  type MilestoneReward,
  type RecentRecruit,
  type ReferralStatusPayload,
} from "@/lib/referrals.shared";
import { normalizeToken, addTokens } from "@/lib/tokens";

export const ClaimInput = z.object({ threshold: z.number().int().positive() });

export async function requireUserId(): Promise<number> {
  const session = await readSession();
  const userId = session.data?.userId;
  if (!userId) throw new Error("unauthorized");
  return userId;
}

/** Qualified = has progress row with enough merges OR glory. */
async function countQualifiedReferrals(userId: number): Promise<number> {
  const res = await sql`
    SELECT COUNT(*)::int AS c
    FROM users u
    INNER JOIN progress p ON p.user_id = u.id
    WHERE u.referred_by = ${userId}
      AND (
        COALESCE(p.total_merges, 0) >= ${REFERRAL_QUALIFY_MIN_MERGES}
        OR COALESCE(p.glory, 0) >= ${REFERRAL_QUALIFY_MIN_GLORY}
      )
  `;
  return Number(res.rows[0]?.c ?? 0);
}

async function countRawReferrals(userId: number): Promise<number> {
  const res = await sql`
    SELECT COUNT(*)::int AS c FROM users WHERE referred_by = ${userId}
  `;
  return Number(res.rows[0]?.c ?? 0);
}

async function recentRecruits(userId: number): Promise<RecentRecruit[]> {
  const res = await sql`
    SELECT
      u.username,
      u.first_name,
      u.created_at,
      COALESCE(p.total_merges, 0)::bigint AS total_merges,
      COALESCE(p.glory, 0)::bigint AS glory
    FROM users u
    LEFT JOIN progress p ON p.user_id = u.id
    WHERE u.referred_by = ${userId}
    ORDER BY u.created_at DESC
    LIMIT 12
  `;
  return res.rows.map((r) => {
    const merges = Number(r.total_merges ?? 0);
    const glory = Number(r.glory ?? 0);
    const qualified =
      merges >= REFERRAL_QUALIFY_MIN_MERGES ||
      glory >= REFERRAL_QUALIFY_MIN_GLORY;
    return {
      name: (r.username as string)
        ? `@${r.username}`
        : (r.first_name as string) || "Recruit",
      joinedAt: new Date(r.created_at as string).getTime(),
      qualified,
    };
  });
}

function buildStatus(
  code: string,
  qualifiedCount: number,
  rawCount: number,
  bitmap: number,
  recruits: RecentRecruit[],
): ReferralStatusPayload {
  return {
    code,
    botUrl: buildReferralLink(code),
    referralCount: qualifiedCount,
    rawReferralCount: rawCount,
    claimedBitmap: bitmap,
    recentRecruits: recruits,
    milestones: MILESTONES.map((m) => ({
      threshold: m.threshold,
      reward: m.reward,
      claimed: (bitmap & m.bit) !== 0,
      claimable: qualifiedCount >= m.threshold && (bitmap & m.bit) === 0,
    })),
    qualify: {
      minMerges: REFERRAL_QUALIFY_MIN_MERGES,
      minGlory: REFERRAL_QUALIFY_MIN_GLORY,
    },
  };
}

export async function loadReferralStatus(
  userId: number,
): Promise<ReferralStatusPayload | { error: string }> {
  const meRes = await sql`
    SELECT referral_code, referral_milestones_claimed FROM users WHERE id = ${userId} LIMIT 1
  `;
  const me = meRes.rows[0];
  if (!me) return { error: "user_not_found" };

  const [qualified, raw, recruits] = await Promise.all([
    countQualifiedReferrals(userId),
    countRawReferrals(userId),
    recentRecruits(userId),
  ]);

  return buildStatus(
    String(me.referral_code),
    qualified,
    raw,
    Number(me.referral_milestones_claimed ?? 0),
    recruits,
  );
}

export type ClaimMilestoneResult =
  | {
      ok: true;
      reward: MilestoneReward;
      stateJson: string;
      status: ReferralStatusPayload;
    }
  | { ok: false; error: string };

export async function claimMilestone(
  userId: number,
  threshold: number,
): Promise<ClaimMilestoneResult> {
  const milestone = MILESTONES.find((m) => m.threshold === threshold);
  if (!milestone) return { ok: false, error: "unknown_milestone" };

  const referralCount = await countQualifiedReferrals(userId);
  if (referralCount < milestone.threshold) {
    return { ok: false, error: "not_enough_referrals" };
  }

  // Atomic claim: the bit flip only succeeds once.
  const flipRes = await sql`
    UPDATE users
      SET referral_milestones_claimed = referral_milestones_claimed | ${milestone.bit}
      WHERE id = ${userId}
        AND (referral_milestones_claimed & ${milestone.bit}) = 0
      RETURNING referral_milestones_claimed, referral_code, referred_by
  `;
  if (flipRes.rowCount === 0) return { ok: false, error: "already_claimed" };

  const reward = milestone.reward;
  const progRes = await sql`
    SELECT glory, wardog_tokens, warcat_tokens, state FROM progress
    WHERE user_id = ${userId} LIMIT 1
  `;
  const prog = progRes.rows[0];
  if (!prog) return { ok: false, error: "no_progress" };

  const state = (prog.state ?? {}) as Record<string, unknown>;

  const newWardog = addTokens(Number(state.wardogTokens ?? 0), reward.wardog);
  const newWarcat = addTokens(Number(state.warcatTokens ?? 0), reward.warcat);

  const newState = {
    ...state,
    glory: Number(state.glory ?? 0) + reward.glory,
    wardogTokens: newWardog,
    warcatTokens: newWarcat,
  };

  await sql`
    UPDATE progress
      SET glory = ${Number(prog.glory) + reward.glory},
          wardog_tokens = ${newWardog},
          warcat_tokens = ${newWarcat},
          state = ${JSON.stringify(newState)}::jsonb,
          last_sync_at = NOW(),
          updated_at = NOW()
      WHERE user_id = ${userId}
  `;

  // Multi-level (level-2) cut 25%
  const referredBy = flipRes.rows[0]?.referred_by;
  if (referredBy) {
    const cutGlory = Math.floor(reward.glory * 0.25);
    const cutWardog = normalizeToken(reward.wardog * 0.25);
    const cutWarcat = normalizeToken(reward.warcat * 0.25);

    if (cutGlory > 0 || cutWardog > 0 || cutWarcat > 0) {
      const parentProg = await sql`
        SELECT glory, wardog_tokens, warcat_tokens, state
        FROM progress WHERE user_id = ${Number(referredBy)} LIMIT 1
      `;
      if (parentProg.rows[0]) {
        const p = parentProg.rows[0];
        const pState = (p.state ?? {}) as Record<string, unknown>;

        const parentWardog = addTokens(
          Number(pState.wardogTokens ?? 0),
          cutWardog,
        );
        const parentWarcat = addTokens(
          Number(pState.warcatTokens ?? 0),
          cutWarcat,
        );

        const parentNew = {
          ...pState,
          glory: Number(pState.glory ?? 0) + cutGlory,
          wardogTokens: parentWardog,
          warcatTokens: parentWarcat,
        };

        await sql`
          UPDATE progress SET
            glory = ${Number(p.glory) + cutGlory},
            wardog_tokens = ${parentWardog},
            warcat_tokens = ${parentWarcat},
            state = ${JSON.stringify(parentNew)}::jsonb,
            updated_at = NOW()
          WHERE user_id = ${Number(referredBy)}
        `;
      }
    }
  }

  const newBitmap = Number(flipRes.rows[0]?.referral_milestones_claimed ?? 0);
  const code = String(flipRes.rows[0]?.referral_code ?? "");
  const [raw, recruits] = await Promise.all([
    countRawReferrals(userId),
    recentRecruits(userId),
  ]);

  return {
    ok: true,
    reward,
    stateJson: JSON.stringify(newState),
    status: buildStatus(code, referralCount, raw, newBitmap, recruits),
  };
}
