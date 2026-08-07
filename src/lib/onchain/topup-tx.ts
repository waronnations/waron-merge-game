// src/lib/onchain/topup-tx.ts
/**
 * Build a TEP-74 jetton transfer for TonConnect top-up.
 * Message goes to the *user's* jetton wallet; destination = Claim Treasury.
 */

import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;

import { Address, beginCell, toNano } from "@ton/core";
import { CLAIM_TREASURY } from "@/lib/onchain/contracts";
import { WARDOG_CA, WARCAT_CA } from "@/lib/tokens";

/** Jetton decimals for $WARDOG / $WARCAT (same as on-chain claim nano). */
export const JETTON_DECIMALS = 9;

/** TON attached to the jetton-wallet message for fees. */
export const TOPUP_GAS_TON = "0.06";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function tokenMaster(token: "wardog" | "warcat"): string {
  return token === "wardog" ? WARDOG_CA : WARCAT_CA;
}

/** Human amount → nano (9 decimals). */
export function toJettonNano(amount: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  return BigInt(Math.round(amount * 10 ** JETTON_DECIMALS));
}

/**
 * Resolve the sender's jetton-wallet for a master via TonAPI (public).
 */
export async function resolveUserJettonWallet(
  ownerAddress: string,
  masterAddress: string,
): Promise<string> {
  const owner = Address.parse(ownerAddress).toRawString();
  const master = Address.parse(masterAddress).toRawString();
  const url = `https://tonapi.io/v2/accounts/${owner}/jettons/${master}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error("jetton_wallet_not_found");
  }

  const data = (await res.json()) as {
    wallet_address?: { address?: string };
  };
  const raw = data.wallet_address?.address;
  if (!raw) throw new Error("jetton_wallet_not_found");

  return Address.parse(raw).toString({ bounceable: true, urlSafe: true });
}

/**
 * TEP-74 transfer body.
 * Sent to the *user's* jetton wallet; destination = Claim Treasury.
 */
export function buildJettonTransferBodySafe(params: {
  amountNano: bigint;
  destination: string;
  responseDestination: string;
  /** nanoton forwarded to destination (for transfer_notification). */
  forwardTon: bigint;
  comment?: string;
}) {
  const body = beginCell()
    .storeUint(0xf8a7ea5, 32) // transfer
    .storeUint(0, 64) // query_id
    .storeCoins(params.amountNano)
    .storeAddress(Address.parse(params.destination))
    .storeAddress(Address.parse(params.responseDestination))
    .storeBit(false); // custom_payload = null

  body.storeCoins(params.forwardTon);

  if (params.comment && params.comment.length > 0) {
    const commentCell = beginCell()
      .storeUint(0, 32)
      .storeStringTail(params.comment)
      .endCell();
    body.storeBit(true).storeRef(commentCell); // forward_payload in ref
  } else {
    body.storeBit(false); // empty forward_payload
  }

  return body.endCell();
}

/**
 * TonConnect `sendTransaction` payload for a top-up.
 */
export async function buildTopupTransaction(params: {
  token: "wardog" | "warcat";
  amount: number;
  senderAddress: string;
  comment?: string;
  gasTon?: string;
}) {
  const master = tokenMaster(params.token);
  const amountNano = toJettonNano(params.amount);
  if (amountNano <= 0n) throw new Error("invalid_amount");

  const userJettonWallet = await resolveUserJettonWallet(
    params.senderAddress,
    master,
  );

  const body = buildJettonTransferBodySafe({
    amountNano,
    destination: CLAIM_TREASURY.address,
    responseDestination: params.senderAddress,
    forwardTon: toNano("0.01"),
    comment: params.comment,
  });

  const boc = body.toBoc();
  const bytes =
    boc instanceof Uint8Array
      ? boc
      : new Uint8Array(boc as ArrayLike<number>);

  return {
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [
      {
        address: userJettonWallet,
        amount: toNano(params.gasTon ?? TOPUP_GAS_TON).toString(),
        payload: bytesToBase64(bytes),
      },
    ],
  };
}
