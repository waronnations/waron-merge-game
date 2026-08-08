/**
 * Player top-ups → spendable balances.
 * Jettons go to ClaimTreasury; spendable is credited after confirm.
 * Does not touch claimable vault (wardog_tokens − claimed_*).
 */

import { sql } from "@/lib/db.server";
import { CLAIM_TREASURY } from "@/lib/onchain/contracts";
import { normalizeToken, addTokens } from "@/lib/tokens";

export const MIN_TOPUP_AMOUNT = 10;
export const TOPUP_EXPIRES_MINUTES = 30;

export type TopupToken = "wardog" | "warcat";

export interface TopupRow {
  id: number;
  token: TopupToken;
  amount: number;
  status: "pending" | "confirmed" | "expired" | "failed";
  walletAddress: string;
  txHash: string | null;
  comment: string | null;
  createdAt: number;
  confirmedAt: number | null;
  expiresAt: number;
}

export interface SpendableBalances {
  spendableWardog: number;
  spendableWarcat: number;
}

function mapTopup(r: Record<string, unknown>): TopupRow {
  return {
    id: Number(r.id),
    token: r.token as TopupToken,
    amount: Number(r.amount),
    status: r.status as TopupRow["status"],
    walletAddress: String(r.wallet_address ?? ""),
    txHash: (r.tx_hash as string | null) ?? null,
    comment: (r.comment as string | null) ?? null,
    createdAt: new Date(r.created_at as string).getTime(),
    confirmedAt: r.confirmed_at
      ? new Date(r.confirmed_at as string).getTime()
      : null,
    expiresAt: new Date(r.expires_at as string).getTime(),
  };
}

export function getTreasuryDepositAddress(): string {
  return CLAIM_TREASURY.address;
}

export async function getSpendableBalances(
  userId: number,
): Promise<SpendableBalances> {
  const res = await sql`
    SELECT
      COALESCE(spendable_wardog, 0) AS spendable_wardog,
      COALESCE(spendable_warcat, 0) AS spendable_warcat
    FROM progress
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const row = res.rows[0];
  return {
    spendableWardog: Number(row?.spendable_wardog ?? 0),
    spendableWarcat: Number(row?.spendable_warcat ?? 0),
  };
}

export async function listTopups(
  userId: number,
  limit = 20,
): Promise<TopupRow[]> {
  const res = await sql`
    SELECT id, token, amount, status, wallet_address, tx_hash, comment,
           created_at, confirmed_at, expires_at
    FROM topups
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return res.rows.map(mapTopup);
}

/**
 * Create a pending top-up. Client sends jettons to ClaimTreasury
 * with the returned comment in the transfer memo when possible.
 */
export async function createTopupIntent(
  userId: number,
  token: TopupToken,
  amount: number,
  walletAddress: string,
): Promise<
  | {
      ok: true;
      topup: TopupRow;
      depositAddress: string;
      comment: string;
    }
  | { ok: false; error: string }
> {
  const amt = normalizeToken(amount);
  if (amt < MIN_TOPUP_AMOUNT) {
    return { ok: false, error: "below_minimum" };
  }
  if (!walletAddress || walletAddress.length < 10) {
    return { ok: false, error: "wallet_required" };
  }

  // Expire old pending for this user+token (keep ledger clean)
  await sql`
    UPDATE topups
       SET status = 'expired'
     WHERE user_id = ${userId}
       AND token = ${token}
       AND status = 'pending'
       AND expires_at < NOW()
  `;

  const pending = await sql`
    SELECT id FROM topups
    WHERE user_id = ${userId}
      AND token = ${token}
      AND status = 'pending'
      AND expires_at >= NOW()
    LIMIT 1
  `;
  if (pending.rows[0]) {
    return { ok: false, error: "topup_already_pending" };
  }

  // Placeholder comment; finalized after we have id
  const inserted = await sql`
    INSERT INTO topups (
      user_id, token, amount, status, wallet_address, comment, expires_at
    )
    VALUES (
      ${userId},
      ${token},
      ${amt},
      'pending',
      ${walletAddress},
      NULL,
      NOW() + (${TOPUP_EXPIRES_MINUTES} || ' minutes')::interval
    )
    RETURNING id, token, amount, status, wallet_address, tx_hash, comment,
              created_at, confirmed_at, expires_at
  `;

  const row = inserted.rows[0];
  if (!row) return { ok: false, error: "insert_failed" };

  const id = Number(row.id);
  const comment = `WON-TOPUP-${userId}-${id}`;

  await sql`
    UPDATE topups SET comment = ${comment} WHERE id = ${id}
  `;

  const topup = mapTopup({ ...row, comment });

  return {
    ok: true,
    topup,
    depositAddress: getTreasuryDepositAddress(),
    comment,
  };
}

/**
 * Confirm a top-up after the player submitted a jetton transfer.
 * Credits spendable_* only once (tx_hash unique).
 */
export async function confirmTopup(
  userId: number,
  topupId: number,
  txHash: string,
): Promise<
  | { ok: true; topup: TopupRow; spendable: SpendableBalances }
  | { ok: false; error: string }
> {
  const hash = (txHash || "").trim();
  if (!hash || hash.length < 8) {
    return { ok: false, error: "tx_hash_required" };
  }

  const existing = await sql`
    SELECT id, user_id, token, amount, status, wallet_address, tx_hash, comment,
           created_at, confirmed_at, expires_at
    FROM topups
    WHERE id = ${topupId} AND user_id = ${userId}
    LIMIT 1
  `;
  const row = existing.rows[0];
  if (!row) return { ok: false, error: "not_found" };

  if (String(row.status) === "confirmed") {
    return {
      ok: true,
      topup: mapTopup(row),
      spendable: await getSpendableBalances(userId),
    };
  }

  if (String(row.status) !== "pending") {
    return { ok: false, error: "not_pending" };
  }

  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await sql`
      UPDATE topups SET status = 'expired' WHERE id = ${topupId}
    `;
    return { ok: false, error: "expired" };
  }

  const dup = await sql`
    SELECT id FROM topups
    WHERE tx_hash = ${hash} AND id <> ${topupId}
    LIMIT 1
  `;
  if (dup.rows[0]) {
    return { ok: false, error: "tx_already_used" };
  }

  const amount = normalizeToken(Number(row.amount));
  const token = row.token as TopupToken;

  // Ensure progress row exists
  await sql`
    INSERT INTO progress (user_id, state)
    VALUES (${userId}, '{}'::jsonb)
    ON CONFLICT (user_id) DO NOTHING
  `;

  if (token === "wardog") {
    await sql`
      UPDATE progress
         SET spendable_wardog = COALESCE(spendable_wardog, 0) + ${amount},
             updated_at = NOW()
       WHERE user_id = ${userId}
    `;
  } else {
    await sql`
      UPDATE progress
         SET spendable_warcat = COALESCE(spendable_warcat, 0) + ${amount},
             updated_at = NOW()
       WHERE user_id = ${userId}
    `;
  }

  await sql`
    UPDATE topups
       SET status = 'confirmed',
           tx_hash = ${hash},
           confirmed_at = NOW()
     WHERE id = ${topupId}
       AND user_id = ${userId}
       AND status = 'pending'
  `;

  const refreshed = await sql`
    SELECT id, token, amount, status, wallet_address, tx_hash, comment,
           created_at, confirmed_at, expires_at
    FROM topups WHERE id = ${topupId} LIMIT 1
  `;

  return {
    ok: true,
    topup: mapTopup(refreshed.rows[0] ?? row),
    spendable: await getSpendableBalances(userId),
  };
}

/**
 * Debit spendable for a paid action. Returns false if insufficient.
 * Does not touch claimable vault.
 */
export async function debitSpendable(
  userId: number,
  token: TopupToken,
  amount: number,
): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  const amt = normalizeToken(amount);
  if (amt <= 0) return { ok: false, error: "invalid_amount" };

  const balances = await getSpendableBalances(userId);
  const have =
    token === "wardog" ? balances.spendableWardog : balances.spendableWarcat;
  if (have + 1e-9 < amt) {
    return { ok: false, error: "insufficient_spendable" };
  }

  if (token === "wardog") {
    await sql`
      UPDATE progress
         SET spendable_wardog = GREATEST(0, COALESCE(spendable_wardog, 0) - ${amt}),
             updated_at = NOW()
       WHERE user_id = ${userId}
         AND COALESCE(spendable_wardog, 0) >= ${amt}
    `;
  } else {
    await sql`
      UPDATE progress
         SET spendable_warcat = GREATEST(0, COALESCE(spendable_warcat, 0) - ${amt}),
             updated_at = NOW()
       WHERE user_id = ${userId}
         AND COALESCE(spendable_warcat, 0) >= ${amt}
    `;
  }

  const after = await getSpendableBalances(userId);
  const remaining =
    token === "wardog" ? after.spendableWardog : after.spendableWarcat;
  return { ok: true, remaining };
}

export { addTokens };
