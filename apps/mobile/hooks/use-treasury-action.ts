import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseUnits, maxUint256 } from 'viem';

import { publicClient } from '@/lib/chain';
import { env } from '@/lib/env';
import { readAllowance, TOKEN_DECIMALS } from '@/lib/erc20';
import { log } from '@/lib/log';
import { qk } from '@/lib/query';
import {
  encodeTreasuryDeposit,
  encodeTreasuryWithdraw,
  tokenAddress,
  type TreasuryToken,
} from '@/lib/treasury';
import { getOrCreateWallet } from '@/lib/wallet';

export type TreasuryActionKind = 'deposit' | 'withdraw';

export type TreasuryActionArgs = {
  kind: TreasuryActionKind;
  token: TreasuryToken;
  /** Decimal string ("12.50"); converted to 6-decimal units. */
  amount: string;
};

export type TreasuryActionResult = {
  /** Hash of the deposit/withdraw tx. The optional approve tx hash is
   *  surfaced separately so the UI can show two-step progress if it wants to. */
  txHash: `0x${string}`;
  approveTxHash?: `0x${string}`;
  rawAmount: bigint;
  /** Resolves once the deposit/withdraw receipt lands. */
  receipt: Promise<{ settledMs: number }>;
};

export type TreasuryActionPhase = 'approving' | 'broadcasting';

export type TreasuryActionOptions = {
  /** Called as the flow moves between phases so the UI can update its label. */
  onPhase?: (phase: TreasuryActionPhase) => void;
};

/**
 * Single mutation that handles the full deposit / withdraw flow:
 *
 *  - Deposit: check ERC-20 allowance for the treasury, send an `approve` tx
 *    first if needed (we request `maxUint256` to keep follow-up deposits
 *    one-tx), then broadcast `deposit(token, amount)`.
 *  - Withdraw: no approval needed — broadcast `withdraw(token, amount)`.
 *
 * Returns the deposit/withdraw `txHash` and a promise that resolves when the
 * receipt is mined. Mirrors the shape of `useSendUsdc` so the call sites
 * stay symmetric.
 */
export function useTreasuryAction(options: TreasuryActionOptions = {}) {
  const qc = useQueryClient();

  return useMutation<TreasuryActionResult, Error, TreasuryActionArgs>({
    mutationFn: async ({ kind, token, amount }) => {
      log.info('treasury', `${kind} ${amount} ${token}`);
      const wallet = await getOrCreateWallet();
      const rawAmount = parseUnits(amount, TOKEN_DECIMALS);
      let approveTxHash: `0x${string}` | undefined;

      if (kind === 'deposit') {
        const tokenAddr = tokenAddress(token);
        const allowance = await readAllowance(
          tokenAddr,
          wallet.address,
          env.treasuryAddress,
        );
        log.info(
          'treasury.approve',
          `Allowance ${allowance.toString()} vs need ${rawAmount.toString()}`,
          { skip: allowance >= rawAmount },
        );
        if (allowance < rawAmount) {
          options.onPhase?.('approving');
          log.info('treasury.approve', `Requesting max approval for ${token}…`);
          // Request max so subsequent deposits skip this whole branch.
          approveTxHash = await wallet.sendTransaction({
            to: tokenAddr,
            data: encodeApproveMax(env.treasuryAddress),
          });
          // Wait for approval before broadcasting deposit — many RPC routers
          // reject the follow-up tx if the nonce gap isn't sequential.
          await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
          log.info('treasury.approve', `Approved · ${approveTxHash}`);
        }
      }

      options.onPhase?.('broadcasting');

      const { data } =
        kind === 'deposit'
          ? encodeTreasuryDeposit(token, amount)
          : encodeTreasuryWithdraw(token, amount);

      log.info('treasury.exec', `Submitting ${kind}(${token}, ${amount})…`);
      const start = Date.now();
      const txHash = await wallet.sendTransaction({
        to: env.treasuryAddress,
        data,
      });

      const receipt = publicClient
        .waitForTransactionReceipt({ hash: txHash })
        .then((r) => {
          const settledMs = Date.now() - start;
          log.info(
            'treasury.exec',
            `Receipt in ${settledMs}ms · ${r.status} · gas ${r.gasUsed}`,
            { txHash, blockNumber: r.blockNumber.toString() },
          );
          qc.invalidateQueries({ queryKey: qk.transactions });
          qc.invalidateQueries({ queryKey: qk.treasuryBalance(wallet.address) });
          return { settledMs };
        })
        .catch((e) => {
          log.error('treasury.exec', `Receipt wait failed: ${(e as Error).message}`, {
            txHash,
          });
          throw e;
        });

      return { txHash, approveTxHash, rawAmount, receipt };
    },
  });
}

/** Hand-rolled max-allowance approve calldata. Saves a redundant parseUnits. */
function encodeApproveMax(spender: `0x${string}`): `0x${string}` {
  // approve(address,uint256) selector = 0x095ea7b3
  const selector = '0x095ea7b3';
  const paddedAddr = spender.slice(2).toLowerCase().padStart(64, '0');
  const paddedAmt = maxUint256.toString(16).padStart(64, '0');
  return (selector + paddedAddr + paddedAmt) as `0x${string}`;
}
