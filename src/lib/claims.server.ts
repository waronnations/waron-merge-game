/**
 * Server-only claim ledger + on-chain claim preparation.
 *
 * Lock is provisional. If the player never signs a TON tx, or the
 * authorization expires, claimed_* is rolled back and the row is refunded.
 */

import { z } from "zod";
import { randomBytes } from "crypto";
import { Address } from "@ton/core";
import { sql } from "@/lib/db.server";
import { loadUser } from "@/lib/auth.server";
import {
  MIN_TREASURY_CLAIM,
  claimTokens,
  getTreasuryHealth,
  type TreasuryHealth,
} from "@/lib/treasury.server";
import { isOnChainLive, CLAIM_TREASURY } from "@/lib/onchain/contracts";
import {
  signClaimAuthorization,
  toNanoTokens,
} from "@/lib/onchain/claim-signer.server";
import { normalizeToken } from "@/lib/tokens";

export const MIN_CLAIM_AMOUNT = MIN_TREASURY_CLAIM;

/** Soft TTL when deadline is missing (slightly longer than 10-min auth). */
const STALE_PENDING_SECONDS = 12 * 60;

export const ClaimRequestInput = z.object({
  token: z.enum(["wardog", "warcat"]),
  beneficiaryAddress: z.string().min(10).optional(),
  amount: z.number().positive().finite().optional(),
});

export const ClaimRefundInput = z.object({
  claimId: z.number().int().positive(),
});

export interface ClaimRow {
  id: number;
  token: "wardog" | "warcat";
  amount: number;
  status: "pending" | "sent" | "failed" | "refunded";
  walletAddress: string;
  txHash: string | null;
  createdAt: number;
  nonce?: string | null;
  deadline?: number | null;
  onchainStatus?: string | null;
}

export interface ClaimsSnapshot {
  available: boolean;
  walletAddress: string | null;
  minAmount: number;
  balances: { wardog: number; warcat: number };
  claimed: { wardog: number; warcat: number };
  total: { wardog: number; warcat: number };
  claims: ClaimRow[];
  treasury: TreasuryHealth;
  economyNote: string;
  onChainLive: boolean;
  claimTreasuryAddress: string;
}

function mapRow(r: Record<string, unknown>): ClaimRow {
  const status = r.status as ClaimRow["status"];
  const onchainStatus = (r.onchain_status as string | null) ?? null;

  const effectiveStatus: ClaimRow["status"] =
    status === "pending" &&
    (onchainStatus === "submitted" || onchainStatus === "confirmed")
      ? "sent"
      : status;

  return {
    id: Number(r.id),
    token: r.token as ClaimRow["token"],
    amount: Number(r.amount),
    status: effectiveStatus,
    walletAddress: String(r.wallet_address),
    txHash: (r.tx_hash as string | null) ?? null,
    createdAt: new Date(r.created_at as string).getTime(),
    nonce: (r.nonce as string | null) ?? null,
    deadline: r.deadline != null ? Number(r.deadline) : null,
    onchainStatus,
  };
}

async function listClaims(userId: number): Promise<ClaimRow[]> {
  const res = await sql`
    SELECT id, token, amount, status, wallet_address, tx_hash, created_at,
           nonce, deadline, onchain_status
    FROM claims WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 20
  `;
  return res.rows.map(mapRow);
}

function normalizeTonAddress(raw: string): string | null {
  try {
    return Address.parse(raw.trim()).toString();
  } catch {
    return null;
  }
}

/**
 * Roll back claimed_* and mark the ledger refunded.
 * Safe to call twice — second call is a no-op.
 */
export async function refundClaim(
  userId: number,
  claimId: number,
  reason: string = "unsigned_or_failed",
): Promise<{ ok: boolean; error?: string; snapshot?: ClaimsSnapshot }> {
  const rowRes = await sql`
    SELECT id, token, amount, status, onchain_status, tx_hash
      FROM claims
     WHERE id = ${claimId} AND user_id = ${userId}
     LIMIT 1
  `;
  const row = rowRes.rows[0];
  if (!row) return { ok: false, error: "not_found" };

  const status = String(row.status);
  const onchain = String(row.onchain_status ?? "");

  if (status === "refunded") {
    return { ok: true, snapshot: await loadClaimsSnapshot(userId, false) };
  }

  // Never unwind a payout that was accepted by the wallet / chain.
  if (
    status === "sent" ||
    onchain === "submitted" ||
    onchain === "confirmed"
  ) {
    return { ok: false, error: "already_submitted" };
  }

  if (status !== "pending" && status !== "failed") {
    return { ok: false, error: "not_refundable" };
  }

  const token = row.token as "wardog" | "warcat";
  const amount = normalizeToken(Number(row.amount));

  const flipped = await sql`
    UPDATE claims
       SET status = 'refunded',
           onchain_status = ${reason},
           updated_at = NOW()
     WHERE id = ${claimId}
       AND user_id = ${userId}
       AND status IN ('pending', 'failed')
     RETURNING id
  `;
  if (flipped.rowCount === 0) {
    return { ok: false, error: "not_refundable" };
  }

  if (token === "wardog") {
    await sql`
      UPDATE progress
         SET claimed_wardog = GREATEST(
               0,
               COALESCE(claimed_wardog, 0) - ${amount}
             ),
             updated_at = NOW()
       WHERE user_id = ${userId}
    `;
  } else {
    await sql`
      UPDATE progress
         SET claimed_warcat = GREATEST(
               0,
               COALESCE(claimed_warcat, 0) - ${amount}
             ),
             updated_at = NOW()
       WHERE user_id = ${userId}
    `;
  }

  return { ok: true, snapshot: await loadClaimsSnapshot(userId, false) };
}

/**
 * Refund pending claims whose on-chain window expired and no tx was sent.
 */
export async function expireStaleClaims(userId: number): Promise<number> {
  const nowSec = Math.floor(Date.now() / 1000);
  const stale = await sql`
    SELECT id
      FROM claims
     WHERE user_id = ${userId}
       AND status = 'pending'
       AND COALESCE(onchain_status, '') NOT IN ('submitted', 'confirmed')
       AND tx_hash IS NULL
       AND (
         (deadline IS NOT NULL AND deadline < ${nowSec})
         OR (
           deadline IS NULL
           AND created_at < NOW() - (${STALE_PENDING_SECONDS} || ' seconds')::interval
         )
       )
  `;

  let n = 0;
  for (const r of stale.rows) {
    const res = await refundClaim(userId, Number(r.id), "expired_unsigned");
    if (res.ok) n += 1;
  }
  return n;
}

export async function loadClaimsSnapshot(
  userId: number,
  expire = true,
): Promise<ClaimsSnapshot> {
  if (expire) {
    try {
      await expireStaleClaims(userId);
    } catch (e) {
      console.error("[loadClaimsSnapshot] expire failed", e);
    }
  }

  const user = await loadUser(userId);
  const prog = await sql`
    SELECT wardog_tokens, warcat_tokens,
           COALESCE(claimed_wardog, 0) AS claimed_wardog,
           COALESCE(claimed_warcat, 0) AS claimed_warcat
    FROM progress WHERE user_id = ${userId} LIMIT 1
  `;
  const p = prog.rows[0];
  const totalWardog = Number(p?.wardog_tokens ?? 0);
  const totalWarcat = Number(p?.warcat_tokens ?? 0);
  const claimedWardog = Number(p?.claimed_wardog ?? 0);
  const claimedWarcat = Number(p?.claimed_warcat ?? 0);

  return {
    available: true,
    walletAddress: user?.walletAddress ?? null,
    minAmount: MIN_CLAIM_AMOUNT,
    balances: {
      wardog: Math.max(0, totalWardog - claimedWardog),
      warcat: Math.max(0, totalWarcat - claimedWarcat),
    },
    claimed: { wardog: claimedWardog, warcat: claimedWarcat },
    total: { wardog: totalWardog, warcat: totalWarcat },
    claims: await listClaims(userId),
    treasury: await getTreasuryHealth(),
    economyNote: isOnChainLive()
      ? "Claim prepares a TON tx. If you do not sign it, tokens stay claimable."
      : "Playable tokens power the board and shop. Claiming locks them for payout.",
    onChainLive: isOnChainLive(),
    claimTreasuryAddress: CLAIM_TREASURY.address,
  };
}

export type ClaimRequestResult =
  | {
      ok: true;
      claim: ClaimRow;
      snapshot: ClaimsSnapshot;
      note?: string;
      onChain?: {
        token: 0 | 1;
        amount: string;
        beneficiary: string;
        nonce: string;
        deadline: number;
        signature: string;
      };
    }
  | { ok: false; error: string; note?: string };

export async function requestClaim(
  userId: number,
  token: "wardog" | "warcat",
  beneficiaryAddress?: string,
  amount?: number,
): Promise<ClaimRequestResult> {
  await expireStaleClaims(userId);

  const user = await loadUser(userId);

  const raw =
    (beneficiaryAddress && beneficiaryAddress.trim()) ||
    user?.walletAddress ||
    "";
  const beneficiary = normalizeTonAddress(raw);
  if (!beneficiary) {
    return {
      ok: false,
      error: "wallet_not_linked",
      note: "Connect your TON wallet first. Claims pay out to the connected address.",
    };
  }

  await sql`
    UPDATE users
       SET wallet_address = ${beneficiary}
     WHERE id = ${userId}
  `;

  const pending = await sql`
    SELECT id FROM claims
     WHERE user_id = ${userId} AND token = ${token} AND status = 'pending'
     LIMIT 1
  `;
  if (pending.rowCount && pending.rowCount > 0) {
    return {
      ok: false,
      error: "claim_already_pending",
      note: "A claim for this token is already queued. Cancel it or wait for expiry.",
    };
  }

  const res = await claimTokens(userId, token, amount);
  if (!res.ok) {
    const note =
      res.error === "wallet_not_linked"
        ? "Connect your TON wallet first. Claims pay out to the connected address."
        : res.note;
    return { ok: false, error: res.error ?? "claim_failed", note };
  }

  const snapshot = await loadClaimsSnapshot(userId, false);
  const claim = snapshot.claims.find((c) => c.status === "pending" && c.token === token)
    ?? snapshot.claims[0];
  if (!claim) return { ok: false, error: "claim_failed" };

  await sql`
    UPDATE claims
       SET wallet_address = ${beneficiary}
     WHERE id = ${claim.id} AND user_id = ${userId}
  `;

  if (isOnChainLive()) {
    try {
      const tokenCode: 0 | 1 = token === "wardog" ? 0 : 1;
      const amountNano = toNanoTokens(claim.amount);
      const nonce = BigInt("0x" + randomBytes(8).toString("hex"));
      const deadline = Math.floor(Date.now() / 1000) + 10 * 60;

      const { signature } = signClaimAuthorization({
        token: tokenCode,
        amount: amountNano,
        beneficiary,
        nonce,
        deadline,
      });

      await sql`
        UPDATE claims
           SET nonce = ${nonce.toString()},
               deadline = ${deadline},
               signature_hex = ${signature.toString("hex")},
               wallet_address = ${beneficiary},
               onchain_status = 'prepared'
         WHERE id = ${claim.id}
      `;

      return {
        ok: true,
        claim: {
          ...claim,
          walletAddress: beneficiary,
          nonce: nonce.toString(),
          deadline,
          onchainStatus: "prepared",
        },
        snapshot: await loadClaimsSnapshot(userId, false),
        note: res.note,
        onChain: {
          token: tokenCode,
          amount: amountNano.toString(),
          beneficiary,
          nonce: nonce.toString(),
          deadline,
          signature: signature.toString("hex"),
        },
      };
    } catch (e) {
      console.error("[requestClaim] on-chain sign failed", e);
      await refundClaim(userId, claim.id, "sign_failed");
      return {
        ok: false,
        error: "onchain_prepare_failed",
        note: "Could not prepare the on-chain claim. Tokens were not taken.",
      };
    }
  }

  return {
    ok: true,
    claim: { ...claim, walletAddress: beneficiary },
    snapshot: await loadClaimsSnapshot(userId, false),
    note: res.note,
  };
}

export async function markClaimSubmitted(
  userId: number,
  claimId: number,
  txHash: string | null,
): Promise<void> {
  await sql`
    UPDATE claims
       SET status = 'sent',
           onchain_status = 'submitted',
           tx_hash = COALESCE(${txHash}, tx_hash),
           updated_at = NOW()
     WHERE id = ${claimId}
       AND user_id = ${userId}
       AND status IN ('pending', 'sent')
  `;
}

export async function markClaimFailed(
  userId: number,
  claimId: number,
): Promise<{ ok: boolean; snapshot?: ClaimsSnapshot; error?: string }> {
  return refundClaim(userId, claimId, "wallet_rejected");
}
