import {
  encodeFunctionData,
  parseAbi,
  parseUnits,
  type Hex,
} from 'viem';

import { publicClient } from './chain';

export const erc20Abi = parseAbi([
  'function transfer(address to, uint256 value) returns (bool)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

/** All ERC-20s we touch on Base Sepolia (USDC + EURC) are 6-decimal. */
export const TOKEN_DECIMALS = 6;

/** Build call data for ERC-20 `transfer(to, amount)`. */
export function encodeTransfer(
  to: `0x${string}`,
  units: string,
  decimals = TOKEN_DECIMALS,
): { data: Hex; rawAmount: bigint } {
  const rawAmount = parseUnits(units, decimals);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, rawAmount],
  });
  return { data, rawAmount };
}

/** Build call data for ERC-20 `approve(spender, amount)`. */
export function encodeApprove(
  spender: `0x${string}`,
  units: string,
  decimals = TOKEN_DECIMALS,
): { data: Hex; rawAmount: bigint } {
  const rawAmount = parseUnits(units, decimals);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, rawAmount],
  });
  return { data, rawAmount };
}

/** Read current allowance. Used to skip a redundant `approve` tx. */
export async function readAllowance(
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  });
}
