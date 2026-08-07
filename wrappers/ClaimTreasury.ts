import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractABI,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode
} from '@ton/core';

export type ClaimTreasuryConfig = {};

export function claimTreasuryConfigToCell(config: ClaimTreasuryConfig): Cell {
    return beginCell().endCell();
}

export class ClaimTreasury implements Contract {
    abi: ContractABI = { name: 'ClaimTreasury' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new ClaimTreasury(address);
    }

    static createFromConfig(config: ClaimTreasuryConfig, code: Cell, workchain = 0) {
        const data = claimTreasuryConfigToCell(config);
        const init = { code, data };
        return new ClaimTreasury(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
