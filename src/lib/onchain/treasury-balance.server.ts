/**
 * Real on-chain jetton balance reader for the Claim Treasury (server-only).
 *
 * Reads the live $WARDOG / $WARCAT jetton balances held by the deployed
 * ClaimTreasury contract via the public TonAPI v2 REST endpoint:
 *
 *   GET /v2/accounts/{treasury}/jettons/{jettonMaster}  →  { balance, ... }
 *
 * Notes:
 *  - Works on edge runtimes (plain `fetch`, no @ton client / websockets).
 *  - `TON_API_KEY` is optional; the public tier is enough for our poll rate,
 *    and results are cached upstream by `getTreasuryHealth()`.
 *  - Balances are returned in nano units (9 decimals for both tokens).
 *  - This module NEVER participates in the claim payout path — it is a
 *    read-only observability/economy input.
 */

import { WARDOG_CA, WARCAT_CA } from "@/lib/tokens";
import { CLAIM_TREASURY } from "@/lib/onchain/contracts";

/** Jetton decimals for $WARDOG and $WARCAT. */
const JETTON_DECIMALS = 9;
const NANO = 10 ** JETTON_DECIMALS;

const REQUEST_TIMEOUT_MS = 6_000;

function apiBase(): string {
  const network = (process.env["TON_NETWORK"] ?? "mainnet").toLowerCase();
  return network === "testnet"
    ? "https://testnet.tonapi.io"
    : "https://tonapi.io";
}

function authHeaders(): Record<string, string> {
  const key = process.env["TON_API_KEY"];
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}

async function fetchJettonBalance(
  account: string,
  jettonMaster: string,
): Promise<number> {
  const url = `${apiBase()}/v2/accounts/${encodeURIComponent(
    account,
  )}/jettons/${encodeURIComponent(jettonMaster)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: authHeaders(),
      signal: controller.signal,
    });

    // 404 simply means the treasury has no jetton wallet for this master yet.
    if (res.status === 404) return 0;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `TonAPI jetton balance failed [${res.status}]: ${body.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as { balance?: string | number };
    const raw = json?.balance;
    const nano = typeof raw === "string" ? Number(raw) : Number(raw ?? 0);
    if (!Number.isFinite(nano) || nano < 0) return 0;
    return nano / NANO;
  } finally {
    clearTimeout(timer);
  }
}

export interface OnChainTreasuryBalances {
  wardog: number;
  warcat: number;
  /** true when both reads came from chain, false when a fallback was used */
  live: boolean;
  error?: string;
}

/**
 * Reads both treasury jetton balances from chain.
 * Throws on failure — callers decide the fallback policy.
 */
export async function readOnChainTreasuryBalances(): Promise<{
  wardog: number;
  warcat: number;
}> {
  const account = CLAIM_TREASURY.address;
  const [wardog, warcat] = await Promise.all([
    fetchJettonBalance(account, WARDOG_CA),
    fetchJettonBalance(account, WARCAT_CA),
  ]);
  return { wardog, warcat };
}

/** Lightweight reachability probe for the health endpoint. */
export async function probeTreasuryReachable(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    await fetchJettonBalance(CLAIM_TREASURY.address, WARDOG_CA);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
