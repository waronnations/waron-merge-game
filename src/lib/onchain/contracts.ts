/**
 * On-chain contract config for War On Nations.
 * Safe to import from client and server (no secrets).
 */

export type ContractStatus = "not_deployed" | "testnet" | "mainnet";

export interface ContractStub {
  name: string;
  address: string;
  status: ContractStatus;
  responsibility: string;
}

/** Current mainnet ClaimTreasury (v2 deploy). */
export const CLAIM_TREASURY_MAINNET =
  "EQCbh4eA9NFMPhsGmedlxk47uIq4-TvG85YpRkWJom9Bai18";

export const CLAIM_TREASURY: ContractStub = {
  name: "Claim Treasury",
  address:
    process.env.CLAIM_TREASURY_ADDRESS ??
    process.env.VITE_CLAIM_TREASURY_ADDRESS ??
    CLAIM_TREASURY_MAINNET,
  status: "mainnet",
  responsibility:
    "Custodies $WARDOG/$WARCAT reserves and authorizes user-paid claims.",
};

export const ONCHAIN_CONTRACTS = {
  claimTreasury: CLAIM_TREASURY,
} as const;

/**
 * Claim path is live when Claim Treasury is mainnet.
 * CLAIM_ONCHAIN_LIVE=1 forces on.
 * CLAIM_ONCHAIN_LIVE=0 forces off.
 */
export function isOnChainLive(): boolean {
  if (process.env.CLAIM_ONCHAIN_LIVE === "1") return true;
  if (process.env.CLAIM_ONCHAIN_LIVE === "0") return false;
  return CLAIM_TREASURY.status === "mainnet";
}

export interface TreasuryBalanceReader {
  read(): Promise<{ wardog: number; warcat: number }>;
}

/** Must match on-chain minClaimAmount (1 token @ 9 decimals). */
export const ONCHAIN_MIN_CLAIM_NANO = 1_000_000_000n;

/**
 * Player must attach at least this much TON for claim gas.
 * Must be >= contract MIN_CLAIM_GAS (0.25).
 */
export const ONCHAIN_CLAIM_GAS_TON = "0.25";

export const CLAIM_SIGNER_PUBLIC_KEY =
  process.env.CLAIM_SIGNER_PUBLIC_KEY ??
  process.env.VITE_CLAIM_SIGNER_PUBLIC_KEY ??
  "60085673968782656356933214813587320685963719189531402905188043894885193469400";
