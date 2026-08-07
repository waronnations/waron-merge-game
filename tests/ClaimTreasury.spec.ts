import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { ClaimTreasury } from '../wrappers/ClaimTreasury';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('ClaimTreasury', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('ClaimTreasury');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let claimTreasury: SandboxContract<ClaimTreasury>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        claimTreasury = blockchain.openContract(ClaimTreasury.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await claimTreasury.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: claimTreasury.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and claimTreasury are ready to use
    });
});
