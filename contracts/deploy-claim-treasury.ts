/**
 * Minimal deploy script for ClaimTreasury.
 * Run with: npx ts-node --esm contracts/deploy-claim-treasury.ts
 *
 * Prerequisites:
 *   - @ton/core @ton/ton @ton/crypto installed
 *   - Tact contract compiled (tact ClaimTreasury.tact)
 *   - OWNER_MNEMONIC and CLAIM_SIGNER_PUBLIC_KEY in env
 */

import { Address, Cell, contractAddress, toNano } from "@ton/core";
import { TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import * as fs from "fs";

async function main() {
  const mnemonic = process.env.OWNER_MNEMONIC?.split(" ");
  if (!mnemonic) throw new Error("OWNER_MNEMONIC required");

  const claimSignerPubKey = BigInt(process.env.CLAIM_SIGNER_PUBLIC_KEY || "0");
  if (claimSignerPubKey === 0n) {
    throw new Error("CLAIM_SIGNER_PUBLIC_KEY required (uint256)");
  }

  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const client = new TonClient({
    endpoint:
      process.env.TON_NETWORK === "mainnet"
        ? "https://toncenter.com/api/v2/jsonRPC"
        : "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TON_API_KEY,
  });

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });
  const walletContract = client.open(wallet);
  const sender = walletContract.sender(keyPair.secretKey);

  // Load compiled code + data (after `tact` compile)
  // Replace these paths with the real output from the Tact compiler
  const code = Cell.fromBoc(fs.readFileSync("./contracts/output/ClaimTreasury.code.boc"))[0];
  const data = beginCell()
    .storeAddress(wallet.address)          // owner
    .storeUint(claimSignerPubKey, 256)     // claimSigner
    // + other init fields according to the contract
    .endCell();

  const init = { code, data };
  const address = contractAddress(0, init);

  console.log("Deploying ClaimTreasury to", address.toString());

  await client.send(
    internal({
      to: address,
      value: toNano("0.15"),
      init,
      body: beginCell().endCell(), // empty deploy body
    }),
  );

  console.log("Deploy transaction sent. Update CLAIM_TREASURY.address in contracts.ts");
}

main().catch(console.error);
