import { encodeTransfer, TOKEN_DECIMALS } from './erc20';
import type { Hex } from 'viem';

/** Re-exported so existing call sites keep their constant import. */
export const USDC_DECIMALS = TOKEN_DECIMALS;

/**
 * Build the call data for a USDC `transfer(to, amount)` invocation.
 * `dollars` is a decimal string ("12.50"); we parse to 6-decimal units.
 *
 * Thin wrapper over the generic `encodeTransfer` helper in `lib/erc20.ts`.
 */
export function encodeUsdcTransfer(
  to: `0x${string}`,
  dollars: string,
): { data: Hex; rawAmount: bigint } {
  return encodeTransfer(to, dollars, USDC_DECIMALS);
}
