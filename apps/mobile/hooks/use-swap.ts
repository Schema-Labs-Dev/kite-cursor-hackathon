import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ContractFunctionExecutionError } from 'viem';
import {
  applySlippage,
  encodeApprove,
  encodeExactInputSingle,
  parseAmount,
  quote,
  readAllowance,
  tokensFor,
  TOKEN_DECIMALS,
  UNISWAP,
  type SwapDirection,
} from '@/lib/uniswap';
import { publicClient } from '@/lib/chain';
import { log } from '@/lib/log';
import { qk } from '@/lib/query';
import { getOrCreateWallet } from '@/lib/wallet';
import { formatUnits } from 'viem';

export type SwapPhase =
  | 'idle'
  | 'approving'
  | 'swapping'
  | 'waiting'
  | 'done';

export type SwapResult = {
  approveHash?: `0x${string}`;
  swapHash: `0x${string}`;
  amountInRaw: bigint;
  amountOutRaw: bigint;
  settleMs: number;
};

/** Default slippage tolerance (bps). 50 bps = 0.5%. */
const SLIPPAGE_BPS = 50;

/**
 * Live off-chain quote — debounced inside the screen by the caller.
 * Returns `null` while there's no input; throws if the pool is empty.
 */
export function useSwapQuote(direction: SwapDirection, dollars: string) {
  const [out, setOut] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const amountIn = useMemo(() => {
    const n = parseFloat(dollars);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return parseAmount(dollars);
    } catch {
      return null;
    }
  }, [dollars]);

  useEffect(() => {
    if (!amountIn) {
      setOut(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    quote(direction, amountIn)
      .then((r) => {
        if (!cancelled) setOut(r);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e);
          setOut(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [direction, amountIn]);

  return {
    amountInRaw: amountIn,
    amountOutRaw: out,
    amountOutFormatted: out !== null ? formatUnits(out, TOKEN_DECIMALS) : null,
    loading,
    error,
  };
}

export function useSwap() {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<SwapPhase>('idle');

  const mutation = useMutation<
    SwapResult,
    Error,
    { direction: SwapDirection; dollars: string }
  >({
    mutationFn: async ({ direction, dollars }) => {
      log.info('swap', `${direction} · ${dollars}`);
      const wallet = await getOrCreateWallet();
      const { tokenIn, tokenOut } = tokensFor(direction);
      const amountIn = parseAmount(dollars);

      const start = Date.now();

      // 1. Quote (also surfaces a clean error if the pool is empty).
      log.info('swap.quote', `Quoting ${dollars} ${direction.split('_TO_')[0]}`, {
        tokenIn,
        tokenOut,
      });
      const amountOut = await quote(direction, amountIn);
      const amountOutMin = applySlippage(amountOut, SLIPPAGE_BPS);
      log.info(
        'swap.quote',
        `Quote: ${formatUnits(amountOut, 6)} out · min ${formatUnits(amountOutMin, 6)} (${SLIPPAGE_BPS} bps slippage)`,
      );

      // 2. Approve if the existing allowance can't cover us.
      const allowance = await readAllowance(tokenIn, wallet.address);
      log.info('swap.approve', `Allowance ${formatUnits(allowance, 6)} vs need ${dollars}`, {
        skip: allowance >= amountIn,
      });
      let approveHash: `0x${string}` | undefined;
      if (allowance < amountIn) {
        setPhase('approving');
        log.info('swap.approve', `Approving ${dollars} to SwapRouter…`);
        approveHash = await wallet.sendTransaction({
          to: tokenIn,
          data: encodeApprove(amountIn),
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        log.info('swap.approve', `Approved · ${approveHash}`);
      }

      // 3. Swap.
      setPhase('swapping');
      log.info('swap.exec', `Submitting exactInputSingle…`);
      const swapHash = await wallet.sendTransaction({
        to: UNISWAP.router,
        data: encodeExactInputSingle({
          tokenIn,
          tokenOut,
          recipient: wallet.address,
          amountIn,
          amountOutMinimum: amountOutMin,
        }),
      });

      setPhase('waiting');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
      log.info('swap.exec', `Settled · ${receipt.status} · gas ${receipt.gasUsed}`, {
        txHash: swapHash,
        blockNumber: receipt.blockNumber.toString(),
      });
      setPhase('done');

      // 4. Tell the rest of the app to refresh.
      qc.invalidateQueries({ queryKey: qk.treasuryBalance(wallet.address) });
      qc.invalidateQueries({ queryKey: qk.transactions });

      return {
        approveHash,
        swapHash,
        amountInRaw: amountIn,
        amountOutRaw: amountOut,
        settleMs: Date.now() - start,
      };
    },
    onError: (err) => {
      log.error('swap', `Failed: ${(err as Error).message}`);
      setPhase('idle');
    },
  });

  return { ...mutation, phase, friendlyError: friendlyError(mutation.error) };
}

function friendlyError(err: Error | null): string | null {
  if (!err) return null;
  const msg = err.message.toLowerCase();
  if (err instanceof ContractFunctionExecutionError) {
    if (msg.includes('insufficient liquidity') || msg.includes('spl')) {
      return 'Pool has no liquidity yet — seed it via `pnpm --filter @kite/api pool init`.';
    }
    if (msg.includes('quoter')) {
      return 'No USDC/EURC pool found on Base Sepolia. Run the pool init script first.';
    }
  }
  if (
    msg.includes('insufficient funds') ||
    msg.includes('exceeds the balance') ||
    msg.includes('exceeds allowance (0)') ||
    msg.includes('gas required exceeds')
  ) {
    return 'Your wallet needs a little Sepolia ETH for gas. Fund it at coinbase.com/faucets/base-ethereum-sepolia-faucet and try again.';
  }
  if (msg.includes('transfer amount exceeds balance')) {
    return 'Not enough balance for this swap.';
  }
  if (msg.includes('user rejected')) {
    return 'Cancelled.';
  }
  return err.message;
}
