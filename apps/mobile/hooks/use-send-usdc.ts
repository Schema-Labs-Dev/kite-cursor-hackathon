import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { publicClient } from '@/lib/chain';
import { env } from '@/lib/env';
import { log } from '@/lib/log';
import { qk } from '@/lib/query';
import { encodeUsdcTransfer } from '@/lib/usdc';
import { getOrCreateWallet } from '@/lib/wallet';

export type SendUsdcArgs = {
  to: `0x${string}`;
  /** Decimal dollar string, e.g. "12.50". */
  dollars: string;
  memo?: string;
};

export type SendUsdcResult = {
  txHash: `0x${string}`;
  rawAmount: bigint;
  /** Ms between broadcast and receipt; resolves asynchronously. */
  receipt: Promise<{ settledMs: number }>;
};

/**
 * Single mutation that:
 *  1. Encodes USDC transfer call data.
 *  2. Signs + broadcasts via the on-device wallet.
 *  3. Fires the memo POST so the backend has a placeholder row immediately.
 *  4. Returns the tx hash and a promise that resolves when the receipt lands
 *     (so the success screen can show "settled in X.Xs" once mined).
 */
export function useSendUsdc() {
  const qc = useQueryClient();
  return useMutation<SendUsdcResult, Error, SendUsdcArgs>({
    mutationFn: async ({ to, dollars, memo }) => {
      log.info('send.usdc', `Sending ${dollars} USDC → ${to.slice(0, 6)}…${to.slice(-4)}`, {
        recipient: to,
        memo: memo ?? null,
      });
      const wallet = await getOrCreateWallet();
      const { data, rawAmount } = encodeUsdcTransfer(to, dollars);

      const start = Date.now();
      const txHash = await wallet.sendTransaction({
        to: env.usdcAddress,
        data,
      });
      log.info('send.usdc', `Broadcast in ${Date.now() - start}ms`, { txHash });

      // Fire-and-forget memo POST. We don't block the success screen on it —
      // the indexer's upsert will pick it up either way.
      api
        .post('/transactions/memo', {
          txHash,
          toAddress: to,
          amount: rawAmount.toString(),
          memo: memo ?? '',
        })
        .catch(() => {});

      const receipt = publicClient
        .waitForTransactionReceipt({ hash: txHash })
        .then((r) => {
          const settledMs = Date.now() - start;
          log.info('send.usdc', `Receipt in ${settledMs}ms · status ${r.status} · gas ${r.gasUsed}`, {
            txHash,
            status: r.status,
            blockNumber: r.blockNumber.toString(),
          });
          // Invalidate everything that should refresh post-confirmation.
          qc.invalidateQueries({ queryKey: qk.transactions });
          qc.invalidateQueries({ queryKey: qk.treasuryBalance(wallet.address) });
          qc.invalidateQueries({ queryKey: qk.contacts });
          return { settledMs };
        })
        .catch((e) => {
          log.error('send.usdc', `Receipt wait failed: ${(e as Error).message}`, { txHash });
          throw e;
        });

      return { txHash, rawAmount, receipt };
    },
  });
}
