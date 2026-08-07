/**
 * TypeScript client for the ClaimTreasury Tact contract.
 * Safe to import from server code only (uses @ton/core).
 *
 * After you deploy the contract and put the real address into
 * src/lib/onchain/contracts.ts + env, this module talks to it.
 */

import {
  Address,
  beginCell,
  Cell,
  Contract,
  ContractProvider,
  Sender,
  SendMode,
  Slice,
  toNano,
} from "@ton/core";
import { CLAIM_TREASURY } from "./contracts";

export type ClaimToken = 0 | 1; // 0 = WARDOG, 1 = WARCAT

export interface ClaimParams {
  token: ClaimToken;
  amount: bigint;          // in nano-units (9 decimals for these jettons)
  beneficiary: Address;
  nonce: bigint;
  deadline: number;        // unix seconds
  signature: Buffer;       // 64-byte Ed25519 signature
}

export class ClaimTreasury implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new ClaimTreasury(address);
  }

  // ── Getters ───────────────────────────────────────────────────────────

  async getVersion(provider: ContractProvider): Promise<number> {
    const { stack } = await provider.get("version", []);
    return stack.readNumber();
  }

  async getIsPaused(provider: ContractProvider): Promise<boolean> {
    const { stack } = await provider.get("isPaused", []);
    return stack.readBoolean();
  }

  async getClaimSigner(provider: ContractProvider): Promise<bigint> {
    const { stack } = await provider.get("getClaimSigner", []);
    return stack.readBigNumber();
  }

  async getBalances(provider: ContractProvider): Promise<{ wardog: bigint; warcat: bigint }> {
    const { stack } = await provider.get("getBalances", []);
    const wardog = stack.readBigNumber();
    const warcat = stack.readBigNumber();
    return { wardog, warcat };
  }

  async getJettonWallets(
    provider: ContractProvider,
  ): Promise<{ wardog: Address | null; warcat: Address | null }> {
    const { stack } = await provider.get("getJettonWallets", []);
    const wardog = stack.readAddressOpt();
    const warcat = stack.readAddressOpt();
    return { wardog, warcat };
  }

  // ── Admin messages ────────────────────────────────────────────────────

  async sendUpgrade(
    provider: ContractProvider,
    via: Sender,
    opts: { code?: Cell; data?: Cell; value?: bigint },
  ) {
    await provider.internal(via, {
      value: opts.value ?? toNano("0.05"),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0, 32) // opcode placeholder – real opcode comes from Tact ABI
        .storeMaybeRef(opts.code ?? null)
        .storeMaybeRef(opts.data ?? null)
        .endCell(),
    });
  }

  async sendSetPaused(
    provider: ContractProvider,
    via: Sender,
    paused: boolean,
    value: bigint = toNano("0.02"),
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(1, 32) // temporary opcode – replace with real after compile
        .storeBit(paused)
        .endCell(),
    });
  }

  async sendSetClaimSigner(
    provider: ContractProvider,
    via: Sender,
    publicKey: bigint,
    value: bigint = toNano("0.02"),
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(2, 32)
        .storeUint(publicKey, 256)
        .endCell(),
    });
  }

  async sendSetJettonWallets(
    provider: ContractProvider,
    via: Sender,
    wardogWallet: Address,
    warcatWallet: Address,
    value: bigint = toNano("0.03"),
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(3, 32)
        .storeAddress(wardogWallet)
        .storeAddress(warcatWallet)
        .endCell(),
    });
  }

  async sendMigrateAssets(
    provider: ContractProvider,
    via: Sender,
    to: Address,
    value: bigint = toNano("0.1"),
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(4, 32)
        .storeAddress(to)
        .endCell(),
    });
  }

  // ── User claim ────────────────────────────────────────────────────────

  /**
   * Build the cell that the server must sign.
   * Layout must match exactly the one in ClaimTreasury.tact
   */
  static buildClaimData(params: {
    token: ClaimToken;
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

  async sendClaim(
    provider: ContractProvider,
    via: Sender,
    params: ClaimParams,
    value: bigint = toNano("0.08"),
  ) {
    const body = beginCell()
      .storeUint(5, 32) // temporary opcode – will be replaced by real Tact opcode after compile
      .storeUint(params.token, 8)
      .storeCoins(params.amount)
      .storeAddress(params.beneficiary)
      .storeUint(params.nonce, 64)
      .storeUint(params.deadline, 32)
      .storeBuffer(params.signature)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body,
    });
  }
}

/** Convenience factory that uses the address from contracts.ts */
export function getClaimTreasuryContract(): ClaimTreasury {
  if (CLAIM_TREASURY.status === "not_deployed") {
    throw new Error("ClaimTreasury is not deployed yet");
  }
  return ClaimTreasury.createFromAddress(Address.parse(CLAIM_TREASURY.address));
}
