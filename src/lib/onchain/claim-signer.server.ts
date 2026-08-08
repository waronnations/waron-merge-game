/**
 * Server-only Ed25519 claim authorization for ClaimTreasury.
 * NEVER import this from client components.
 */

import { beginCell, Address } from "@ton/core";
import { sign, keyPairFromSeed } from "@ton/crypto";

function getKeyPair() {
  const hex = process.env.CLAIM_SIGNER_PRIVATE_KEY;
  if (!hex) {
    throw new Error("CLAIM_SIGNER_PRIVATE_KEY is not set");
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length === 64) {
    return { publicKey: buf.subarray(32), secretKey: buf };
  }
  if (buf.length === 32) {
    return keyPairFromSeed(buf);
  }
  throw new Error("CLAIM_SIGNER_PRIVATE_KEY must be 32 or 64 bytes hex");
}

/** Exact cell the ClaimTreasury contract hashes and verifies. */
export function buildClaimDataCell(params: {
  token: 0 | 1;
  amount: bigint;
  beneficiary: string;
  nonce: bigint;
  deadline: number;
}) {
  return beginCell()
    .storeUint(params.token, 8)
    .storeCoins(params.amount)
    .storeAddress(Address.parse(params.beneficiary))
    .storeUint(params.nonce, 64)
    .storeUint(params.deadline, 32)
    .endCell();
}

export function signClaimAuthorization(params: {
  token: 0 | 1;
  amount: bigint;
  beneficiary: string;
  nonce: bigint;
  deadline: number;
}): { signature: Buffer; hash: Buffer } {
  const keyPair = getKeyPair();
  const dataCell = buildClaimDataCell(params);
  const hash = dataCell.hash();
  const signature = sign(hash, keyPair.secretKey);
  return { signature, hash };
}

/** Human token amount → nano units (9 decimals). */
export function toNanoTokens(amount: number): bigint {
  return BigInt(Math.round(Number(amount) * 1e9));
}
