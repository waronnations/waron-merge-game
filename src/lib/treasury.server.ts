/**
 * ════════════════════════════════════════════════════════════════════════
 * SELF-REGULATING CLAIM TREASURY (server-only)
 * ════════════════════════════════════════════════════════════════════════
 *
 * The treasury backs every claimable $WARDOG / $WARCAT balance in the game.
 * Its job is simple: the pool must NEVER run out of tokens. It does that by
 * measuring a Health Ratio (HR) and raising a dynamic tax multiplier on every
 * economic fee in the game as the pool gets thinner. Taxes are recorded as
 * pending treasury deposits, which top the pool back up.
 *
 *   HR = (onChainWardog + onChainWarcat) / totalOutstandingClaimable
 *
 *   Green    HR >= 1.50            → max(x1.0, PROTOCOL_TAX_MULT_FLOOR)
 *   Yellow   1.20 <= HR < 1.50     → max(curve, floor)
 *   Red      1.00 <= HR < 1.20     → max(curve, floor)
 *   Critical HR < 1.00             → max(x5.0, floor)
 *
 * PROTOCOL_TAX_MULT_FLOOR (1.05) guarantees every paid action always pays
 * at least +5% tax, even in green. Merge board stays free (energy only).
 *
 * ON-CHAIN SOURCE OF TRUTH
 * ------------------------
 * `treasuryReader` reads the LIVE jetton balances held by the deployed
 * Claim Treasury (see `src/lib/onchain/treasury-balance.server.ts`). If the
 * indexer is unreachable, the last good reading is reused; only when no
 * reading has ever succeeded do we fall back to the conservative floor
 * (which puts the economy in its safest, highest-tax zone) or to explicit
 * `TREASURY_MOCK_*` overrides used by local dev.
 */

import { sql } from "@/lib/db.server";
import { normalizeToken } from "@/lib/tokens";
import { CLAIM_TREASURY, type TreasuryBalanceReader } from "@/lib/onchain/contracts";
import { readOnChainTreasuryBalances } from "@/lib/onchain/treasury-balance.server";

/** Treasury address surfaced to the UI. */
export const CLAIM_TREASURY_ADDRESS = CLAIM_TREASURY.address;

/**
 * Minimum multiplier applied to every taxable fee (shop, recover, vault,
 * marketplace, battlefield, …). Green can never zero-out tax.
 * 1.05 = always +5% on base price. Zone curve only raises this.
 */
export const PROTOCOL_TAX_MULT_FLOOR = 1.05;

/** Percent label for UI (e.g. "5% protocol tax"). */
export const PROTOCOL_TAX_FLOOR_PCT = Math.round(
  (PROTOCOL_TAX_MULT_FLOOR - 1) * 100,
);

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Last successful on-chain reading, reused when the indexer hiccups. */
let lastGoodBalances: { wardog: number; warcat: number; at: number } | null =
  null;

/** Explicit local/dev override (also used when the chain is unreachable). */
function overrideBalances(): { wardog: number; warcat: number } | null {
  const w = process.env["TREASURY_MOCK_WARDOG"];
  const c = process.env["TREASURY_MOCK_WARCAT"];
  if (w === undefined && c === undefined) return null;
  return {
    wardog: envNumber("TREASURY_MOCK_WARDOG", 0),
    warcat: envNumber("TREASURY_MOCK_WARCAT", 0),
  };
}

/** Reads the real jetton balances the Claim Treasury holds. */
export const treasuryReader: TreasuryBalanceReader = {
  async read() {
    const override = overrideBalances();
    if (override) return override;

    try {
      const balances = await readOnChainTreasuryBalances();
      lastGoodBalances = { ...balances, at: Date.now() };
      return balances;
    } catch (e) {
      console.error("[treasury] on-chain balance read failed", e);
      if (lastGoodBalances) {
        return {
          wardog: lastGoodBalances.wardog,
          warcat: lastGoodBalances.warcat,
        };
      }
      // No reading ever succeeded → assume an empty pool (critical zone,
      // max tax, smallest claim caps). Fail safe, never fail generous.
      return { wardog: 0, warcat: 0 };
    }
  },
};

/** Diagnostics for the health endpoint / admin tooling. */
export function treasuryReaderStatus(): {
  mode: "onchain" | "override";
  lastGoodAt: number | null;
} {
  return {
    mode: overrideBalances() ? "override" : "onchain",
    lastGoodAt: lastGoodBalances?.at ?? null,
  };
}

export type TreasuryZone = "green" | "yellow" | "red" | "critical";

export interface TreasuryHealth {
  balanceWardog: number;
  balanceWarcat: number;
  totalClaimable: number;
  healthRatio: number;
  taxMultiplier: number;
  zone: TreasuryZone;
  updatedAt: number;
}

/**
 * Zone curve from the economy spec (before protocol floor).
 * Infinite / healthy HR returns 1.0; floor is applied in getTreasuryHealth.
 */
export function taxMultiplierForRatio(hr: number): number {
  if (!Number.isFinite(hr)) return 1;
  if (hr >= 1.5) return 1.0;
  if (hr >= 1.2) return 1.5 + ((1.5 - hr) / 0.3) * 0.5;
  if (hr >= 1.0) return 2.5 + ((1.2 - hr) / 0.2) * 1.5;
  return 5.0;
}

/** Effective multiplier = max(zone curve, protocol floor). */
export function effectiveTaxMultiplier(hr: number): number {
  return Math.max(taxMultiplierForRatio(hr), PROTOCOL_TAX_MULT_FLOOR);
}

export function zoneForRatio(hr: number): TreasuryZone {
  if (hr >= 1.5) return "green";
  if (hr >= 1.2) return "yellow";
  if (hr >= 1.0) return "red";
  return "critical";
}

/**
 * Total tokens users could still claim:
 *   sum(wardog_tokens - claimed_wardog) + sum(warcat_tokens - claimed_warcat)
 * Never negative per user, so a data glitch cannot inflate the ratio.
 */
export async function getTotalOutstandingClaimable(): Promise<number> {
  const res = await sql`
    SELECT COALESCE(SUM(
      GREATEST(0, wardog_tokens - COALESCE(claimed_wardog, 0)) +
      GREATEST(0, warcat_tokens - COALESCE(claimed_warcat, 0))
    ), 0) AS outstanding
    FROM progress
  `;
  return normalizeToken(Number(res.rows[0]?.outstanding ?? 0));
}

// Short in-process cache: the health card polls and every taxed action reads
// this, so we avoid hammering Postgres on bursts. Cheap and safe (5s).
let healthCache: { value: TreasuryHealth; at: number } | null = null;
const HEALTH_TTL_MS = 5_000;

export async function getTreasuryHealth(
  opts?: { fresh?: boolean },
): Promise<TreasuryHealth> {
  const now = Date.now();
  if (!opts?.fresh && healthCache && now - healthCache.at < HEALTH_TTL_MS) {
    return healthCache.value;
  }

  const [{ wardog, warcat }, outstanding] = await Promise.all([
    treasuryReader.read(),
    getTotalOutstandingClaimable(),
  ]);

  const balance = normalizeToken(wardog + warcat);
  // With nothing outstanding the pool is trivially healthy.
  const healthRatio =
    outstanding <= 0 ? Number.POSITIVE_INFINITY : balance / outstanding;
  const displayRatio = Number.isFinite(healthRatio)
    ? Math.round(healthRatio * 1000) / 1000
    : 999;

  const taxMultiplier =
    Math.round(effectiveTaxMultiplier(healthRatio) * 1000) / 1000;

  const value: TreasuryHealth = {
    balanceWardog: normalizeToken(wardog),
    balanceWarcat: normalizeToken(warcat),
    totalClaimable: outstanding,
    healthRatio: displayRatio,
    taxMultiplier,
    zone: zoneForRatio(healthRatio),
    updatedAt: now,
  };

  healthCache = { value, at: now };
  return value;
}

/**
 * Applies the live treasury multiplier to a base FEE / COST.
 *
 * MUST be used by every taxable economic action (shop, energy recovery,
 * vault donations, marketplace purchases, protection, redemption,
 * battlefield weapon buys, …) so the economy self-regulates.
 *
 * Returns the final amount the user actually pays (base × mult ≥ base × floor).
 *
 * NOT used on: merge / spawn / swap (energy only) or passive energy regen.
 */
export async function applyDynamicTax(
  baseAmount: number,
  _token: "wardog" | "warcat",
): Promise<number> {
  const base = Number(baseAmount);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const { taxMultiplier } = await getTreasuryHealth();
  return normalizeToken(base * taxMultiplier);
}

/** Same as applyDynamicTax but returns the breakdown for UI/receipts. */
export async function quoteDynamicTax(
  baseAmount: number,
): Promise<{
  base: number;
  final: number;
  tax: number;
  multiplier: number;
  zone: TreasuryZone;
}> {
  const health = await getTreasuryHealth();
  const base = normalizeToken(Math.max(0, Number(baseAmount) || 0));
  const final = normalizeToken(base * health.taxMultiplier);
  return {
    base,
    final,
    tax: normalizeToken(final - base),
    multiplier: health.taxMultiplier,
    zone: health.zone,
  };
}

/**
 * Records a taxed amount as a PENDING treasury deposit.
 *
 * Today this is bookkeeping only: it proves how much the treasury is owed by
 * the game economy. Once the Claim Treasury contract is live these rows are
 * what an operator (or an automated relayer) settles on-chain.
 */
export async function recordTreasuryDeposit(params: {
  userId: number | null;
  source: string;
  wardog?: number;
  warcat?: number;
  baseAmount?: number;
  multiplier?: number;
  details?: Record<string, unknown>;
}): Promise<void> {
  const wardog = normalizeToken(Math.max(0, Number(params.wardog ?? 0)));
  const warcat = normalizeToken(Math.max(0, Number(params.warcat ?? 0)));
  if (wardog <= 0 && warcat <= 0) return;

  await sql`
    INSERT INTO treasury_deposits
      (user_id, source, wardog, warcat, base_amount, multiplier, status, details)
    VALUES (
      ${params.userId},
      ${params.source},
      ${wardog},
      ${warcat},
      ${normalizeToken(Math.max(0, Number(params.baseAmount ?? 0)))},
      ${Number(params.multiplier ?? 1)},
      'pending',
      ${JSON.stringify(params.details ?? {})}::jsonb
    )
  `;
}

/**
 * Tokens a user has already moved into "claimed" state. They stay visible in
 * the in-game vault as lifetime earnings but must NOT be spendable, otherwise
 * a player could claim and then spend the same tokens (double-spend against
 * the treasury). Every economic spend subtracts this reserve first.
 */
export async function getClaimedReserve(
  userId: number,
): Promise<{ wardog: number; warcat: number }> {
  const res = await sql`
    SELECT COALESCE(claimed_wardog, 0) AS w, COALESCE(claimed_warcat, 0) AS c
    FROM progress WHERE user_id = ${userId} LIMIT 1
  `;
  const r = res.rows[0];
  return {
    wardog: normalizeToken(Number(r?.w ?? 0)),
    warcat: normalizeToken(Number(r?.c ?? 0)),
  };
}

// ── Claim caps by zone ─────────────────────────────────────────────────
/**
 * The treasury throttles redemption when it is thin. Green/Yellow allow a
 * full claim; Red allows a partial claim; Critical pauses claims entirely so
 * the pool can refill from taxes.
 */
export const CLAIM_ZONE_RULES: Record<
  TreasuryZone,
  { fraction: number; dailyCap: number; note: string }
> = {
  green: {
    fraction: 1,
    dailyCap: Number.POSITIVE_INFINITY,
    note: "Full claims open.",
  },
  yellow: {
    fraction: 1,
    dailyCap: 5_000,
    note: "Full claims, daily cap applies.",
  },
  red: {
    fraction: 0.25,
    dailyCap: 1_000,
    note: "Partial claims only (25%).",
  },
  critical: {
    fraction: 0,
    dailyCap: 0,
    note: "Claims paused while the pool refills.",
  },
};

export const MIN_TREASURY_CLAIM = 10;

export interface ClaimTokensResult {
  ok: boolean;
  error?: string;
  zone?: TreasuryZone;
  requested?: number;
  claimed?: number;
  remaining?: number;
  note?: string;
}

/**
 * Zone-aware claim: moves tokens from "available" to "claimed".
 *
 * `claimed_wardog` / `claimed_warcat` are cumulative counters, so
 * outstanding = tokens - claimed and the health ratio drops as soon as a
 * claim is authorized. A `claims` row is also written so the payout queue
 * stays the single source of truth for the future on-chain settlement.
 */
export async function claimTokens(
  userId: number,
  token: "wardog" | "warcat",
  requestedAmount?: number,
): Promise<ClaimTokensResult> {
  const health = await getTreasuryHealth({ fresh: true });
  const rules = CLAIM_ZONE_RULES[health.zone];

  if (rules.fraction <= 0) {
    return {
      ok: false,
      error: "claims_paused",
      zone: health.zone,
      note: rules.note,
    };
  }

  const userRes = await sql`
    SELECT wallet_address FROM users WHERE id = ${userId} LIMIT 1
  `;
  const walletAddress =
    (userRes.rows[0]?.wallet_address as string | null) ?? null;
  if (!walletAddress) {
    return { ok: false, error: "wallet_not_linked", zone: health.zone };
  }

  const progRes = await sql`
    SELECT wardog_tokens, warcat_tokens,
           COALESCE(claimed_wardog, 0) AS claimed_wardog,
           COALESCE(claimed_warcat, 0) AS claimed_warcat
    FROM progress WHERE user_id = ${userId} LIMIT 1
  `;
  const prog = progRes.rows[0];
  if (!prog) return { ok: false, error: "no_progress", zone: health.zone };

  const available = normalizeToken(
    token === "wardog"
      ? Number(prog.wardog_tokens) - Number(prog.claimed_wardog)
      : Number(prog.warcat_tokens) - Number(prog.claimed_warcat),
  );
  if (available < MIN_TREASURY_CLAIM) {
    return {
      ok: false,
      error: "below_minimum",
      zone: health.zone,
      remaining: available,
    };
  }

  // How much was already claimed in the last 24h (zone daily cap).
  const dayRes = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total FROM claims
     WHERE user_id = ${userId} AND token = ${token}
       AND created_at > NOW() - INTERVAL '24 hours'
       AND status <> 'refunded'
  `;
  const claimedToday = Number(dayRes.rows[0]?.total ?? 0);
  const capRoom = Number.isFinite(rules.dailyCap)
    ? Math.max(0, rules.dailyCap - claimedToday)
    : Number.POSITIVE_INFINITY;
  if (capRoom <= 0) {
    return {
      ok: false,
      error: "daily_cap_reached",
      zone: health.zone,
      note: rules.note,
    };
  }

  const desired =
    requestedAmount && requestedAmount > 0
      ? Math.min(requestedAmount, available)
      : available;
  const amount = normalizeToken(
    Math.min(desired * rules.fraction, capRoom, available),
  );
  if (amount < MIN_TREASURY_CLAIM) {
    return {
      ok: false,
      error: "amount_too_small_for_zone",
      zone: health.zone,
      note: rules.note,
      remaining: available,
    };
  }

  // Atomic: only bump `claimed_*` while the balance still covers it.
  const updated =
    token === "wardog"
      ? await sql`
          UPDATE progress
             SET claimed_wardog = COALESCE(claimed_wardog, 0) + ${amount},
                 updated_at = NOW()
           WHERE user_id = ${userId}
             AND wardog_tokens - COALESCE(claimed_wardog, 0) >= ${amount}
           RETURNING wardog_tokens, claimed_wardog
        `
      : await sql`
          UPDATE progress
             SET claimed_warcat = COALESCE(claimed_warcat, 0) + ${amount},
                 updated_at = NOW()
           WHERE user_id = ${userId}
             AND warcat_tokens - COALESCE(claimed_warcat, 0) >= ${amount}
           RETURNING warcat_tokens, claimed_warcat
        `;
  if (updated.rowCount === 0) {
    return { ok: false, error: "balance_changed", zone: health.zone };
  }

  await sql`
    INSERT INTO claims (user_id, token, amount, status, wallet_address)
    VALUES (${userId}, ${token}, ${amount}, 'pending', ${walletAddress})
  `;

  healthCache = null; // outstanding changed
  return {
    ok: true,
    zone: health.zone,
    requested: normalizeToken(desired),
    claimed: amount,
    remaining: normalizeToken(available - amount),
    note: rules.note,
  };
}
