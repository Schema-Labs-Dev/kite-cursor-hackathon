import {
  encodeFunctionData,
  parseAbi,
  parseUnits,
  type Hex,
} from 'viem';
import { env } from './env';
import { publicClient } from './chain';

/**
 * Uniswap V3 swap glue for USDC ↔ EURC on Base Sepolia.
 *
 * Contracts (verified from https://developers.uniswap.org/contracts/v3/reference/deployments/base-deployments):
 *   Factory:                 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
 *   SwapRouter02:            0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
 *   QuoterV2:                0xC5290058841028F1614F3A6F0F5816cAd0df5E27
 *   NonfungiblePositionMgr:  0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2
 *
 * The USDC/EURC pool itself is seeded by us via apps/api/scripts/init-swap-pool.ts
 * (Uniswap doesn't ship one on testnet).
 */

export const UNISWAP = {
  factory:  '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' as `0x${string}`,
  router:   '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' as `0x${string}`,
  quoter:   '0xC5290058841028F1614F3A6F0F5816cAd0df5E27' as `0x${string}`,
  nfpm:     '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2' as `0x${string}`,
} as const;

/** 0.01% fee tier — the standard pick for stable-to-stable pairs. */
export const POOL_FEE = 100;

/** Both USDC and EURC use 6 decimals on Base Sepolia. */
export const TOKEN_DECIMALS = 6;

export type SwapDirection = 'USDC_TO_EURC' | 'EURC_TO_USDC';

export function tokensFor(direction: SwapDirection) {
  return direction === 'USDC_TO_EURC'
    ? {
        tokenIn: env.usdcAddress,
        tokenOut: env.eurcAddress,
        inSymbol: 'USDC' as const,
        outSymbol: 'EURC' as const,
        inSign: '$',
        outSign: '€',
      }
    : {
        tokenIn: env.eurcAddress,
        tokenOut: env.usdcAddress,
        inSymbol: 'EURC' as const,
        outSymbol: 'USDC' as const,
        inSign: '€',
        outSign: '$',
      };
}

const erc20Abi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const quoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

const routerAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
]);

/**
 * Off-chain quote via QuoterV2. Returns the expected raw `amountOut` in
 * 6-decimal token units. Throws if the pool has no liquidity / doesn't exist.
 */
export async function quote(
  direction: SwapDirection,
  amountIn: bigint,
): Promise<bigint> {
  const { tokenIn, tokenOut } = tokensFor(direction);
  const { result } = await publicClient.simulateContract({
    address: UNISWAP.quoter,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn,
        tokenOut,
        amountIn,
        fee: POOL_FEE,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  return result[0];
}

export async function readAllowance(
  token: `0x${string}`,
  owner: `0x${string}`,
): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, UNISWAP.router],
  });
}

export function encodeApprove(amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [UNISWAP.router, amount],
  });
}

export function encodeExactInputSingle(args: {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  recipient: `0x${string}`;
  amountIn: bigint;
  amountOutMinimum: bigint;
}): Hex {
  return encodeFunctionData({
    abi: routerAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: args.tokenIn,
        tokenOut: args.tokenOut,
        fee: POOL_FEE,
        recipient: args.recipient,
        amountIn: args.amountIn,
        amountOutMinimum: args.amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
}

export function parseAmount(dollars: string): bigint {
  return parseUnits(dollars, TOKEN_DECIMALS);
}

/** Apply slippage tolerance (e.g. 0.5 % → 50 bps). */
export function applySlippage(amount: bigint, bps: number): bigint {
  const denom = 10_000n;
  const factor = denom - BigInt(bps);
  return (amount * factor) / denom;
}
