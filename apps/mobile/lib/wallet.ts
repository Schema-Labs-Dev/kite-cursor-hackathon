import * as SecureStore from 'expo-secure-store';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { Hex } from 'viem';

import { makeWalletClient } from './chain';
import { env } from './env';
import { log } from './log';
import { getSmartAccountClient, resetSmartAccount } from './smart-account';

/**
 * On-device wallet — Coinbase Smart Account ERC-4337, EOA signer.
 *
 * Two modes, selected automatically based on `EXPO_PUBLIC_CDP_RPC_URL`:
 *
 *   1. **Smart account mode** (CDP URL set) — the on-device EOA is the
 *      *signer* for a counterfactually-deployed Coinbase Smart Account (same
 *      contract Coinbase Smart Wallet deploys). All transactions become
 *      UserOperations sponsored by the CDP Paymaster. Users never need ETH.
 *      `wallet.address` is the smart account address.
 *
 *   2. **Plain EOA fallback** (CDP URL empty) — the EOA itself signs +
 *      broadcasts via a viem `walletClient`. User pays gas in Sepolia ETH.
 *      Same `Wallet` interface. Useful during local dev before CDP is set
 *      up, and as a safety net if the bundler/paymaster is unreachable.
 *
 * Switching modes only changes the address that the wallet reports, so
 * once you flip CDP_RPC_URL on you should also wipe the on-device key (or
 * the existing user record) — otherwise sign-in will create a fresh user
 * for the smart account address.
 */

const PK_KEY = 'kite.wallet.privateKey';

export interface Wallet {
  address: `0x${string}`;
  signMessage: (message: string) => Promise<`0x${string}`>;
  sendTransaction: (req: SendTxRequest) => Promise<`0x${string}`>;
  /** 'smart' = sponsored UserOp via CDP, 'eoa' = user-paid gas via viem walletClient. */
  kind: 'smart' | 'eoa';
}

export type SendTxRequest = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
  capabilities?: Record<string, unknown>;
};

let cached: Wallet | null = null;

export async function getOrCreateWallet(): Promise<Wallet> {
  if (cached) return cached;

  let pk = (await SecureStore.getItemAsync(PK_KEY)) as Hex | null;
  const freshKey = !pk;
  if (!pk) {
    pk = generatePrivateKey();
    await SecureStore.setItemAsync(PK_KEY, pk);
  }

  const owner = privateKeyToAccount(pk);
  log.info(
    'wallet.init',
    `${freshKey ? 'Generated' : 'Loaded'} signer · ${env.cdpRpcUrl ? 'smart account' : 'plain EOA'} mode`,
    { signerAddress: owner.address },
  );

  cached = env.cdpRpcUrl ? await buildSmartWallet(owner) : buildEoaWallet(owner);
  log.info('wallet.init', `Ready · ${cached.kind} · ${cached.address}`, {
    walletAddress: cached.address,
    kind: cached.kind,
  });
  return cached;
}

async function buildSmartWallet(owner: PrivateKeyAccount): Promise<Wallet> {
  const client = await getSmartAccountClient(owner);
  const account = client.account!;
  return {
    address: account.address,
    kind: 'smart',
    signMessage: async (message) => {
      log.info('wallet.sign', `Smart account signing SIWE (ERC-6492 wrapped if undeployed)`);
      try {
        const sig = await account.signMessage({ message });
        log.info('wallet.sign', `Signed · ${sig.length} chars`);
        return sig;
      } catch (e) {
        log.error('wallet.sign', `Sign failed: ${(e as Error).message}`);
        throw e;
      }
    },
    sendTransaction: async ({ to, data, value }) => {
      const t0 = Date.now();
      log.info('wallet.send', `UserOp → ${shortAddr(to)}`, {
        to,
        selector: data?.slice(0, 10),
        value: value ? value.toString() : '0',
        bytes: data ? (data.length - 2) / 2 : 0,
      });
      try {
        const hash = await client.sendTransaction({
          account,
          chain: client.chain,
          to,
          data,
          value: value ?? 0n,
        });
        log.info('wallet.send', `Confirmed in ${Date.now() - t0}ms · ${shortAddr(hash)}`, {
          txHash: hash,
        });
        return hash;
      } catch (e) {
        log.error('wallet.send', `UserOp failed: ${(e as Error).message}`, {
          to,
          selector: data?.slice(0, 10),
        });
        throw e;
      }
    },
  };
}

function buildEoaWallet(owner: PrivateKeyAccount): Wallet {
  const client = makeWalletClient(owner);
  return {
    address: owner.address,
    kind: 'eoa',
    signMessage: async (message) => {
      log.info('wallet.sign', `EOA signing SIWE`);
      try {
        const sig = await owner.signMessage({ message });
        log.info('wallet.sign', `Signed · ${sig.length} chars`);
        return sig;
      } catch (e) {
        log.error('wallet.sign', `Sign failed: ${(e as Error).message}`);
        throw e;
      }
    },
    sendTransaction: async ({ to, data, value }) => {
      const t0 = Date.now();
      log.info('wallet.send', `EOA tx → ${shortAddr(to)}`, {
        to,
        selector: data?.slice(0, 10),
        value: value ? value.toString() : '0',
      });
      try {
        const hash = await client.sendTransaction({ to, data, value });
        log.info('wallet.send', `Broadcast in ${Date.now() - t0}ms · ${shortAddr(hash)}`, {
          txHash: hash,
        });
        return hash;
      } catch (e) {
        log.error('wallet.send', `Tx failed: ${(e as Error).message}`, { to });
        throw e;
      }
    },
  };
}

function shortAddr(s: string): string {
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

/** Wipe the on-device wallet. Pairs with `signOut()` for a true "reset". */
export async function resetWallet(): Promise<void> {
  cached = null;
  resetSmartAccount();
  await SecureStore.deleteItemAsync(PK_KEY);
}

/** Returns the currently-cached wallet or null without creating one. */
export function peekWallet(): Wallet | null {
  return cached;
}
