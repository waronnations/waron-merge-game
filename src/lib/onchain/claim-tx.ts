/**
 * Client-safe Claim message builder for TON Connect.
 * Buffer is polyfilled before @ton/core is used; BOC is base64'd without Node Buffer.toString.
 */

import { Buffer } from "buffer";

// Set global Buffer BEFORE any @ton/core call (module init can still race; ClaimPanel also sets this)
const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;

import { beginCell, Address, toNano } from "@ton/core";
import {
  CLAIM_TREASURY,
  ONCHAIN_CLAIM_GAS_TON,
} from "@/lib/onchain/contracts";

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error("invalid signature hex length");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function buildClaimBody(params: {
  token: 0 | 1;
  amount: bigint;
  beneficiary: string;
  nonce: bigint;
  deadline: number;
  signatureHex: string;
}) {
  // Must match claim-signer.server.ts: deadline is 32 bits
  const sig = Buffer.from(hexToBytes(params.signatureHex));

  return beginCell()
    .storeUint(0x434c4149, 32) // "CLAI"
    .storeUint(params.token, 8)
    .storeCoins(params.amount)
    .storeAddress(Address.parse(params.beneficiary))
    .storeUint(params.nonce, 64)
    .storeUint(params.deadline, 32)
    .storeBuffer(sig)
    .endCell();
}

/** Payload for tonConnectUI.sendTransaction — player pays gas. */
export function buildClaimTransaction(params: {
  token: 0 | 1;
  amount: bigint;
  beneficiary: string;
  nonce: bigint;
  deadline: number;
  signatureHex: string;
  gasTon?: string;
}) {
  const body = buildClaimBody(params);
  const boc = body.toBoc();
  const bytes =
    boc instanceof Uint8Array
      ? boc
      : new Uint8Array(
          (boc as { length: number; [i: number]: number }) as ArrayLike<number>,
        );

  return {
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [
      {
        address: CLAIM_TREASURY.address,
        amount: toNano(params.gasTon ?? ONCHAIN_CLAIM_GAS_TON).toString(),
        // Do NOT use .toString("base64") — that needs Node Buffer in the browser
        payload: bytesToBase64(bytes),
      },
    ],
  };
}
