import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseUnits } from 'viem';

import { api } from '@/lib/api';
import { publicClient } from '@/lib/chain';
import { env } from '@/lib/env';
import { encodeTransfer, TOKEN_DECIMALS } from '@/lib/erc20';
import { log } from '@/lib/log';
import type { Merchant } from '@/lib/merchants';
import { qk } from '@/lib/query';
import { getOrCreateWallet } from '@/lib/wallet';

export type CardPayToken = 'USDC' | 'EURC';

export type CardPayArgs = {
  merchant: Merchant;
  token: CardPayToken;
  /** Decimal dollar/euro string ("4.50") — converted to 6-decimal units. */
  amount: string;
};

export type CardPayResult = {
  txHash: `0x${string}`;
  rawAmount: bigint;
  /** Resolves when the receipt is mined. */
  receipt: Promise<{ settledMs: number; blockNumber: number }>;
};

/**
 * Real on-chain card payment. Sends ERC-20 `transfer(merchant, amount)` of
 * the chosen token via the user's smart account (sponsored gas via CDP),
 * then attaches a `Card · <merchant>` memo so the row shows up tagged in
 * Activity. Everything else flows through the existing send pipeline —
 * indexer picks up the on-chain Transfer, wallet balance refetches, etc.
 */
export function useCardPay() {
  const qc = useQueryClient();

  return useMutation<CardPayResult, Error, CardPayArgs>({
    mutationFn: async ({ merchant, token, amount }) => {
      log.info('card.pay', `${amount} ${token} → ${merchant.name}`, {
        merchant: merchant.address,
      });

      const wallet = await getOrCreateWallet();
      const tokenAddr =
        token === 'USDC' ? env.usdcAddress : env.eurcAddress;
      const { data, rawAmount } = encodeTransfer(
        merchant.address,
        amount,
        TOKEN_DECIMALS,
      );

      const start = Date.now();
      const txHash = await wallet.sendTransaction({
        to: tokenAddr,
        data,
      });
      log.info('card.pay', `Broadcast · ${txHash}`);

      // Fire-and-forget memo so the row carries "Card · Vidae Café" even
      // before the indexer sees the on-chain event.
      api
        .post('/transactions/memo', {
          txHash,
          toAddress: merchant.address,
          amount: rawAmount.toString(),
          memo: `Card · ${merchant.name}`,
        })
        .catch((e) =>
          log.warn('card.pay', `memo POST failed: ${(e as Error).message}`),
        );

      const receipt = publicClient
        .waitForTransactionReceipt({ hash: txHash })
        .then((r) => {
          const settledMs = Date.now() - start;
          log.info(
            'card.pay',
            `Receipt in ${settledMs}ms · ${r.status} · gas ${r.gasUsed}`,
            { txHash, blockNumber: r.blockNumber.toString() },
          );
          qc.invalidateQueries({ queryKey: qk.treasuryBalance(wallet.address) });
          qc.invalidateQueries({ queryKey: qk.transactions });
          return {
            settledMs,
            blockNumber: Number(r.blockNumber),
          };
        })
        .catch((e) => {
          log.error(
            'card.pay',
            `Receipt wait failed: ${(e as Error).message}`,
            { txHash },
          );
          throw e;
        });

      return { txHash, rawAmount, receipt };
    },
    onError: (err) => {
      log.error('card.pay', `Failed: ${(err as Error).message}`);
    },
  });
}

/** Convert "4.50" to raw 6-decimal uint. */
export function cardAmountToRaw(amount: string): bigint {
  return parseUnits(amount, TOKEN_DECIMALS);
}
