// src/lib/memewar/war-tx.ts
/**
 * Client-side TonConnect payload for a War Merge: one transaction with
 *   1) the War Tax jetton transfer → Claim Treasury
 *   2) the STON.fi v1 swap (jetton transfer → router with swap forward payload)
 */
import "@/lib/onchain/buffer-polyfill";
import { Address, beginCell, toNano, type Cell } from "@ton/core";
import { CLAIM_TREASURY } from "@/lib/onchain/contracts";
import { buildJettonTransferBodySafe, resolveUserJettonWallet } from "@/lib/onchain/topup-tx";
import { MEMEWAR_TAX_GAS_TON } from "@/lib/constants/memewar";
import type { SwapQuote } from "./types";

const STONFI_V1_SWAP_OP = 0x25938561;

function b64(cell: Cell): string {
  const boc = new Uint8Array(cell.toBoc());
  let s = "";
  for (const byte of boc) s += String.fromCharCode(byte);
  return btoa(s);
}

export async function buildWarMergeTx(params: {
  owner: string;
  quote: SwapQuote;
  tax: { master: string; units: bigint } | null;
}) {
  const { owner, quote, tax } = params;
  if (!quote.executable || !quote.stonfi) throw new Error("route_not_executable");
  const messages: { address: string; amount: string; payload: string }[] = [];

  if (tax && tax.units > 0n) {
    const taxWallet = await resolveUserJettonWallet(owner, tax.master);
    const body = buildJettonTransferBodySafe({
      amountNano: tax.units,
      destination: CLAIM_TREASURY.address,
      responseDestination: owner,
      forwardTon: 1n,
      comment: "WAR_TAX",
    });
    messages.push({ address: taxWallet, amount: toNano(MEMEWAR_TAX_GAS_TON).toString(), payload: b64(body) });
  }

  const offerWallet = await resolveUserJettonWallet(owner, quote.offerMaster);
  const swapPayload = beginCell()
    .storeUint(STONFI_V1_SWAP_OP, 32)
    .storeAddress(Address.parse(quote.stonfi.askJettonWallet))
    .storeCoins(BigInt(quote.minAskUnits))
    .storeAddress(Address.parse(owner))
    .storeBit(false) // no referral
    .endCell();
  const transfer = beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(BigInt(Date.now()), 64)
    .storeCoins(BigInt(quote.offerUnits))
    .storeAddress(Address.parse(quote.stonfi.routerAddress))
    .storeAddress(Address.parse(owner))
    .storeBit(false)
    .storeCoins(BigInt(quote.stonfi.forwardGas))
    .storeBit(true)
    .storeRef(swapPayload)
    .endCell();
  messages.push({ address: offerWallet, amount: quote.stonfi.gasBudget, payload: b64(transfer) });

  return { validUntil: Math.floor(Date.now() / 1000) + 300, messages };
}
