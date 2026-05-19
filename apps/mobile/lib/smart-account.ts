import { createPublicClient, http } from 'viem';
import {
  createPaymasterClient,
  toCoinbaseSmartAccount,
} from 'viem/account-abstraction';
import { baseSepolia } from 'viem/chains';
import { createSmartAccountClient, type SmartAccountClient } from 'permissionless';
import type { PrivateKeyAccount } from 'viem/accounts';
import { env } from './env';

/**
 * Wraps an EOA owner in a Coinbase Smart Account (ERC-4337, same contract
 * Coinbase Smart Wallet deploys). All transactions become UserOperations
 * sponsored by the CDP Paymaster — users never need to hold ETH for gas.
 *
 * Returns a viem-compatible client whose `sendTransaction` / `sendUserOperation`
 * route through the CDP bundler + paymaster. The smart account is deployed
 * counterfactually on the first user op.
 *
 * Throws if EXPO_PUBLIC_CDP_RPC_URL isn't configured.
 */

let cached: SmartAccountClient | null = null;

export async function getSmartAccountClient(
  owner: PrivateKeyAccount,
): Promise<SmartAccountClient> {
  if (cached) return cached;
  if (!env.cdpRpcUrl) {
    throw new Error(
      'EXPO_PUBLIC_CDP_RPC_URL not set. Get it from coinbase.com/cdp → your project → Paymaster & Bundler → Base Sepolia, then put it in apps/mobile/.env.',
    );
  }

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(env.baseRpcUrl),
  });

  // Coinbase Smart Account — the same contract Coinbase Smart Wallet deploys.
  // Address is derived from `owners` so it's deterministic; the contract is
  // deployed on first user-op (paymaster covers that cost too).
  const account = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [owner],
    version: '1',
  });

  // CDP serves bundler + paymaster on the same URL via the ERC-7677 spec.
  const paymaster = createPaymasterClient({
    transport: http(env.cdpRpcUrl),
  });

  cached = createSmartAccountClient({
    account,
    chain: baseSepolia,
    bundlerTransport: http(env.cdpRpcUrl),
    paymaster,
    userOperation: {
      // Pull max fees from the bundler — CDP returns sane defaults.
      estimateFeesPerGas: async () => {
        const block = await publicClient.getBlock({ blockTag: 'latest' });
        const base = block.baseFeePerGas ?? 1_000_000n;
        return {
          maxFeePerGas: base * 2n + 1_000_000n,
          maxPriorityFeePerGas: 1_000_000n,
        };
      },
    },
  });

  return cached;
}

/** Reset the cached client. Call after wiping the on-device owner key. */
export function resetSmartAccount(): void {
  cached = null;
}

