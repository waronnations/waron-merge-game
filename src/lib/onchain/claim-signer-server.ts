/**
 * Server-only claim authorization signer.
 * Uses the private key that corresponds to the public key stored in ClaimTreasury.
 *
 * Env required:
 *   CLAIM_SIGNER_PRIVATE_KEY  = 64-char hex (or base64) of the Ed25519 private key
 *
 * The signed data layout MUST match exactly the one in ClaimTreasury.tact
 * and ClaimTreasury.buildClaimData().
 */

import { beginCell, Address, Cell } from "@ton/core";
import { sign } from "@ton/crypto";
import { CLAIM_TREASURY } from "./contracts";

export type ClaimTokenId = 0 | 1; // 0 = WARDOG, 1 = WARCAT

export interface SignedClaim {
  token: ClaimTokenId;
  amount: string;          // nano-units as string (safe for JSON)
  beneficiary: string;     // raw or user-friendly address
  nonce: string;
  deadline: number;        // unix seconds
  signature: string;       // base64 of 64-byte signature
  /** Convenience: the cell that was signed (for debugging) */
  dataHash: string;
}

/**
 * Build the exact cell that the contract expects to be signed.
 */
export function buildClaimDataCell(params: {
  token: ClaimTokenId;
  amount: bigint;
  beneficiary: Address;
  nonce: bigint;
  deadline: number;
}): Cell {
  return beginCell()
    .storeUint(params.token, 8)
    .storeCoins(params.amount)
    .storeAddress(params.beneficiary)
    .storeUint(params.nonce, 64)
    .storeUint(params.deadline, 32)
    .endCell();
}

/**
 * Sign a claim authorization.
 * Throws if the private key is missing or malformed.
 */
export async function signClaimAuthorization(params: {
  token: "wardog" | "warcat";
  amountHuman: number;          // game units (e.g. 12.5)
  beneficiary: string;          // user wallet address
  nonce?: bigint;               // optional, auto-generated if omitted
  validitySeconds?: number;     // default 15 minutes
}): Promise<SignedClaim> {
  const privateKeyHex = process.env.CLAIM_SIGNER_PRIVATE_KEY;
  if (!privateKeyHex) {
    throw new Error("CLAIM_SIGNER_PRIVATE_KEY is not configured");
  }

  // Convert human amount → nano (9 decimals)
  const amountNano = BigInt(Math.round(params.amountHuman * 1e9));
  if (amountNano <= 0n) {
    throw new Error("Claim amount must be positive");
  }

  const beneficiary = Address.parse(params.beneficiary);
  const tokenId: ClaimTokenId = params.token === "wardog" ? 0 : 1;
  const nonce = params.nonce ?? BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
  const deadline = Math.floor(Date.now() / 1000) + (params.validitySeconds ?? 15 * 60);

  const dataCell = buildClaimDataCell({
    token: tokenId,
    amount: amountNano,
    beneficiary,
    nonce,
    deadline,
  });

  const hash = dataCell.hash();
  const privateKey = Buffer.from(privateKeyHex.replace(/^0x/, ""), "hex");
  const signature = sign(hash, privateKey);

  return {
    token: tokenId,
    amount: amountNano.toString(),
    beneficiary: beneficiary.toString(),
    nonce: nonce.toString(),
    deadline,
    signature: signature.toString("base64"),
    dataHash: hash.toString("hex"),
  };
}

/** Quick check whether on-chain claims are ready. */
export function isOnChainClaimReady(): boolean {
  return (
    CLAIM_TREASURY.status !== "not_deployed" &&
    Boolean(process.env.CLAIM_SIGNER_PRIVATE_KEY)
  );
}
