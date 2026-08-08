// src/lib/payments.server.ts
/**
 * Server-authoritative wallet authorization intents.
 *
 * Product model (aligned with client PaymentProvider):
 *  1. Player connects a TON wallet (TON Connect) — session until disconnect.
 *  2. `createIntent()` records a pending authorization for a paid action.
 *  3. `confirmIntent()` confirms once a wallet address is bound (no native TON transfer).
 *  4. Paid actions may call `consumePaymentIntent()` / `requirePayment()` when live.
 *  5. Actual spend is always in-game $WARDOG or $WARCAT (shop / nations / redeem).
 *
 * Board energy recover never uses this module.
 *
 * Future jetton settlement (claims / optional shop sinks) is separate from this
 * authorization ledger.
 */

import { sql } from "@/lib/db.server";
import {
  PAID_ACTIONS,
  PAYMENT_INTENT_TTL_MS,
  type PaidActionId,
} from "@/lib/constants";

export type PaymentStatus =
  | "pending"
  | "confirmed"
  | "consumed"
  | "failed"
  | "expired";

export interface PaymentIntentRow {
  id: number;
  action: PaidActionId;
  amountTon: number;
  comment: string;
  status: PaymentStatus;
  mode: "live" | "mock";
  walletAddress: string | null;
  txHash: string | null;
  createdAt: number;
  confirmedAt: number | null;
}

let schemaReady: Promise<void> | null = null;

/** Additive-only schema for the authorization ledger. */
export async function ensurePaymentSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS payment_intents (
          id              BIGSERIAL PRIMARY KEY,
          user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          action          TEXT NOT NULL,
          amount_ton      NUMERIC(20,9) NOT NULL DEFAULT 0,
          comment         TEXT NOT NULL UNIQUE,
          status          TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','confirmed','consumed','failed','expired')),
          mode            TEXT NOT NULL DEFAULT 'mock'
                            CHECK (mode IN ('live','mock')),
          wallet_address  TEXT,
          tx_hash         TEXT,
          treasury        TEXT,
          network         TEXT,
          details         JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          confirmed_at    TIMESTAMPTZ,
          consumed_at     TIMESTAMPTZ
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS payment_intents_user_idx ON payment_intents (user_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS payment_intents_lookup_idx ON payment_intents (user_id, action, status)`;

      // Optional wallet binding on users (additive)
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS users_wallet_address_idx ON users (wallet_address) WHERE wallet_address IS NOT NULL`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function serverEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function serverTreasuryAddress(): string {
  return (
    serverEnv("TON_TREASURY_ADDRESS") || serverEnv("VITE_TON_TREASURY_ADDRESS")
  );
}

export function serverNetwork(): "mainnet" | "testnet" {
  const value = serverEnv("TON_NETWORK") || serverEnv("VITE_TON_NETWORK");
  return value === "testnet" ? "testnet" : "mainnet";
}

/**
 * "Live" means wallet authorization is required and consumed for paid actions.
 * It does NOT mean native TON is charged.
 */
export function paymentsLive(): boolean {
  const enabled =
    serverEnv("TON_PAYMENTS_ENABLED") === "true" ||
    serverEnv("VITE_TON_PAYMENTS_ENABLED") === "true";
  // Live auth only needs the flag — treasury address is for future jetton sinks.
  return enabled;
}

function mapRow(r: Record<string, unknown>): PaymentIntentRow {
  return {
    id: Number(r.id),
    action: String(r.action) as PaidActionId,
    amountTon: Number(r.amount_ton),
    comment: String(r.comment),
    status: r.status as PaymentStatus,
    mode: r.mode as "live" | "mock",
    walletAddress: (r.wallet_address as string | null) ?? null,
    txHash: (r.tx_hash as string | null) ?? null,
    createdAt: new Date(r.created_at as string).getTime(),
    confirmedAt: r.confirmed_at
      ? new Date(r.confirmed_at as string).getTime()
      : null,
  };
}

export function isPaidAction(value: string): value is PaidActionId {
  return Object.prototype.hasOwnProperty.call(PAID_ACTIONS, value);
}

function newComment(userId: number): string {
  const nonce = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `WON-AUTH-${userId}-${Date.now().toString(36).toUpperCase()}-${nonce}`;
}

export interface CreatedIntent {
  intentId: number;
  action: PaidActionId;
  /** Legacy field — always 0; currency is WARDOG/WARCAT in-game. */
  amountTon: number;
  amountNano: string;
  comment: string;
  treasury: string;
  network: "mainnet" | "testnet";
  mode: "live" | "mock";
  validUntil: number;
}

/** Persist wallet on the user row when provided (identity for claims later). */
export async function bindUserWallet(
  userId: number,
  walletAddress: string | null,
): Promise<void> {
  if (!walletAddress || walletAddress.length < 10) return;
  await ensurePaymentSchema();
  await sql`
    UPDATE users
       SET wallet_address = ${walletAddress}
     WHERE id = ${userId}
       AND (wallet_address IS NULL OR wallet_address = ${walletAddress})
  `;
}

export async function createIntent(
  userId: number,
  action: PaidActionId,
  walletAddress: string | null,
): Promise<CreatedIntent> {
  await ensurePaymentSchema();
  await expireStaleIntents(userId);

  if (!walletAddress || walletAddress.trim().length < 10) {
    throw new Error("wallet_required");
  }

  const live = paymentsLive();
  // amount_ton kept for schema compatibility — not charged as native TON
  const amountTon = 0;
  const comment = newComment(userId);
  const treasury = serverTreasuryAddress();
  const network = serverNetwork();
  const wallet = walletAddress.trim();

  await bindUserWallet(userId, wallet);

  const res = await sql`
    INSERT INTO payment_intents
      (user_id, action, amount_ton, comment, status, mode, wallet_address, treasury, network, details)
    VALUES (
      ${userId}, ${action}, ${amountTon}, ${comment},
      ${"pending"}, ${live ? "live" : "mock"}, ${wallet}, ${treasury}, ${network},
      ${JSON.stringify({
        kind: "wallet_auth",
        currency: "wardog_warcat",
        note: "No native TON charged",
      })}::jsonb
    )
    RETURNING id
  `;

  return {
    intentId: Number(res.rows[0]!.id),
    action,
    amountTon,
    amountNano: "0",
    comment,
    treasury,
    network,
    mode: live ? "live" : "mock",
    validUntil: Date.now() + PAYMENT_INTENT_TTL_MS,
  };
}

async function expireStaleIntents(userId: number): Promise<void> {
  const cutoff = new Date(Date.now() - PAYMENT_INTENT_TTL_MS).toISOString();
  await sql`
    UPDATE payment_intents
       SET status = 'expired'
     WHERE user_id = ${userId}
       AND status = 'pending'
       AND created_at < ${cutoff}
  `;
}

export interface ConfirmResult {
  ok: boolean;
  status: PaymentStatus;
  reason?: "not_found" | "expired" | "rate_limited" | "unknown_intent" | "wallet_required";
  txHash?: string | null;
}

/**
 * Confirm wallet authorization.
 * Never requires a native TON transfer — client already proved possession via TON Connect.
 */
export async function confirmIntent(
  userId: number,
  intentId: number,
  _options: { txHash?: string | null; apiKey?: string | null } = {},
): Promise<ConfirmResult> {
  await ensurePaymentSchema();

  const res = await sql`
    SELECT * FROM payment_intents
      WHERE id = ${intentId} AND user_id = ${userId}
      LIMIT 1
  `;
  const row = res.rows[0];
  if (!row) return { ok: false, status: "failed", reason: "unknown_intent" };

  const intent = mapRow(row);
  if (intent.status === "confirmed" || intent.status === "consumed") {
    return { ok: true, status: intent.status, txHash: intent.txHash };
  }
  if (Date.now() - intent.createdAt > PAYMENT_INTENT_TTL_MS) {
    await sql`UPDATE payment_intents SET status = 'expired' WHERE id = ${intentId}`;
    return { ok: false, status: "expired", reason: "expired" };
  }

  if (!intent.walletAddress || intent.walletAddress.length < 10) {
    return { ok: false, status: "pending", reason: "wallet_required" };
  }

  await sql`
    UPDATE payment_intents
       SET status = 'confirmed',
           confirmed_at = NOW(),
           details = details || ${JSON.stringify({
             confirmed: "wallet_auth",
             currency: "wardog_warcat",
             simulated: intent.mode === "mock",
           })}::jsonb
     WHERE id = ${intentId}
       AND status = 'pending'
  `;

  return { ok: true, status: "confirmed", txHash: null };
}

/**
 * Atomically consume one confirmed authorization for `action`.
 */
export async function consumePaymentIntent(
  userId: number,
  action: PaidActionId,
): Promise<boolean> {
  await ensurePaymentSchema();
  const res = await sql`
    UPDATE payment_intents
       SET status = 'consumed', consumed_at = NOW()
     WHERE id = (
       SELECT id FROM payment_intents
        WHERE user_id = ${userId}
          AND action = ${action}
          AND status = 'confirmed'
        ORDER BY confirmed_at ASC
        LIMIT 1
     )
    RETURNING id
  `;
  return res.rows.length > 0;
}

/**
 * Gate a paid action when live authorization is enabled.
 * No-op while paymentsLive() is false (dev / soft launch).
 * Does not charge TON — only consumes a prior wallet authorization.
 */
export async function requirePayment(
  userId: number,
  action: PaidActionId,
): Promise<void> {
  if (!paymentsLive()) return;
  const consumed = await consumePaymentIntent(userId, action);
  if (!consumed) throw new Error("payment_required");
}

export async function listPayments(
  userId: number,
  limit = 25,
): Promise<PaymentIntentRow[]> {
  await ensurePaymentSchema();
  const res = await sql`
    SELECT * FROM payment_intents
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${Math.min(100, Math.max(1, limit))}
  `;
  return res.rows.map(mapRow);
}
