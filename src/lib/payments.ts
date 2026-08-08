// src/lib/payments.ts
/**
 * Client-safe payment / wallet-auth configuration.
 *
 * Model:
 *  · Player connects a TON wallet via TON Connect (stays until disconnect).
 *  · Paid actions (shop, nations, redeem) require wallet authorization.
 *  · Spend is always in-game $WARDOG or $WARCAT — never native TON / $GRAM.
 *  · Board energy recover does not use this module.
 *
 * MOCK vs LIVE refers to whether authorization intents are required/consumed
 * server-side (`VITE_TON_PAYMENTS_ENABLED`), not whether TON is transferred.
 */

import { PAID_ACTIONS, type PaidActionId } from "@/lib/constants";

export type { PaidActionId };
export { PAID_ACTIONS };

export type TonNetwork = "mainnet" | "testnet";

function env(key: string): string {
  const source = (import.meta.env ?? {}) as Record<string, string | undefined>;
  return (source[key] ?? "").trim();
}

export function tonNetwork(): TonNetwork {
  return env("VITE_TON_NETWORK") === "testnet" ? "testnet" : "mainnet";
}

/** Optional treasury address (future jetton sinks / claims). Not used for native TON fees. */
export function treasuryAddress(): string {
  return env("VITE_TON_TREASURY_ADDRESS");
}

/**
 * True when the client should treat authorization as soft/dev
 * (server still records intents; requirePayment is a no-op when not live).
 */
export function paymentsMockMode(): boolean {
  return env("VITE_TON_PAYMENTS_ENABLED") !== "true";
}

export function actionLabel(action: PaidActionId | string): string {
  return (PAID_ACTIONS as Record<string, { label: string }>)[action]?.label ?? String(action);
}

/**
 * @deprecated Legacy TON price field on PAID_ACTIONS — always treat as 0 for UI.
 * Real costs come from SHOP_ITEMS / nation prices in $WARDOG or $WARCAT.
 */
export function actionPrice(_action: PaidActionId): number {
  return 0;
}

/** @deprecated No native TON is charged. Kept so old imports do not break. */
export function toNano(_ton: number): string {
  return "0";
}

/** @deprecated Prefer token labels in UI. */
export function formatTon(_ton: number): string {
  return "$WARDOG / $WARCAT";
}

export function formatAuthCurrency(): string {
  return "$WARDOG / $WARCAT";
}

// ── Optional TonAPI key (future jetton verification / claims indexer) ──
const API_KEY_STORAGE = "won_tonapi_key";

export function getStoredTonApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(API_KEY_STORAGE)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function storeTonApiKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = key.trim();
    if (trimmed) window.localStorage.setItem(API_KEY_STORAGE, trimmed);
    else window.localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    /* storage unavailable */
  }
}

export const TON_API_KEY_PROVIDERS = [
  {
    name: "TON Console (tonapi.io)",
    url: "https://tonconsole.com/tonapi/api-keys",
    hint: "Free tier. Optional — used for future on-chain claim verification.",
  },
  {
    name: "Toncenter Bot",
    url: "https://t.me/tonapibot",
    hint: "Telegram bot — tap /start and copy the key back here.",
  },
] as const;
