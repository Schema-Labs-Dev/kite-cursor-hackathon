import { createPublicClient, createWalletClient, http } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { env } from './env';

const transport = http(env.baseRpcUrl);

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport,
});

export function makeWalletClient(account: PrivateKeyAccount) {
  return createWalletClient({
    chain: baseSepolia,
    transport,
    account,
  });
}
