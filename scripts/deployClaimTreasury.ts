import { toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { ClaimTreasury } from '../build/ClaimTreasury/tact_ClaimTreasury';

export async function run(provider: NetworkProvider) {
  // Public key only (the private key stays on the server later)
  const claimSignerPublicKey = BigInt(process.env.CLAIM_SIGNER_PUBLIC_KEY!);

  const owner = provider.sender().address!;
  const contract = provider.open(
    await ClaimTreasury.fromInit(owner, claimSignerPublicKey)
  );

  await contract.send(
    provider.sender(),
    { value: toNano('0.3') },
    { $$type: 'Deploy', queryId: 0n }
  );

  await provider.waitForDeploy(contract.address);

  console.log('✅ ClaimTreasury deployed at:');
  console.log(contract.address.toString());
  console.log('→ Put only this address into your environment variables');
}
