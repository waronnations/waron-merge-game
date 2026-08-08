/**
 * Server-only claim ledger + on-chain claim preparation.
 *
 * On-chain: locks playable balance, signs Claim for the *current*
 * TonConnect address (beneficiaryAddress), player pays gas.
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

export const MIN_CLAIM_AMOUNT = MIN_TREASURY_CLAIM;

export const ClaimRequestInput = z.object({
  token: z.enum(["wardog", "warcat"]),
  /** Live TonConnect account — preferred payout target */
  beneficiaryAddress: z.string().min(10).optional(),
  /**
   * Optional amount to claim (human units, e.g. 50.5).
   * Omitted / 0 / negative → claim max available (subject to zone rules).
   */
  amount: z.number().positive().finite().optional(),
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

  // Back-compat: older rows may be pending + submitted/confirmed
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

export async function loadClaimsSnapshot(
  userId: number,
): Promise<ClaimsSnapshot> {
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
      ? "Claim locks tokens in-game, then you sign a TON transaction to receive jettons on the wallet currently connected. You pay network gas (~0.25 TON)."
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

  // Pass optional amount — claimTokens clamps to available / zone / daily cap
  const res = await claimTokens(userId, token, amount);
  if (!res.ok) {
    const note =
      res.error === "wallet_not_linked"
        ? "Connect your TON wallet first. Claims pay out to the connected address."
        : res.note;
    return { ok: false, error: res.error ?? "claim_failed", note };
  }

  const snapshot = await loadClaimsSnapshot(userId);
  const claim = snapshot.claims[0];
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
        snapshot: await loadClaimsSnapshot(userId),
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
      return {
        ok: true,
        claim,
        snapshot: await loadClaimsSnapshot(userId),
        note:
          (res.note ?? "") +
          " Locked on server, but on-chain signature failed — contact support.",
      };
    }
  }

  return {
    ok: true,
    claim: { ...claim, walletAddress: beneficiary },
    snapshot: await loadClaimsSnapshot(userId),
    note: res.note,
  };
}

/**
 * Wallet TX was accepted by TonConnect.
 * Mark ledger status sent so history shows "Sent" (not Queued).
 */
export async function markClaimSubmitted(
  userId: number,
  claimId: number,
  txHash: string | null,
): Promise<void> {
  await sql`
    UPDATE claims
       SET status = 'sent',
           onchain_status = 'submitted',
           tx_hash = COALESCE(${txHash}, tx_hash)
     WHERE id = ${claimId}
       AND user_id = ${userId}
       AND status IN ('pending', 'sent')
  `;
}
