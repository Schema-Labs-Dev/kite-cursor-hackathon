import { encodeFunctionData, parseAbi, parseUnits, type Hex } from 'viem';

import { env } from './env';
import { TOKEN_DECIMALS } from './erc20';

export type TreasuryToken = 'USDC' | 'EURC';

const kiteTreasuryAbi = parseAbi([
  'function deposit(address token, uint256 amount)',
  'function withdraw(address token, uint256 amount)',
]);

/** Map a UI token code to its on-chain address. */
export function tokenAddress(token: TreasuryToken): `0x${string}` {
  return token === 'USDC' ? env.usdcAddress : env.eurcAddress;
}

/** Build call data for `KiteTreasury.deposit(token, amount)`. */
export function encodeTreasuryDeposit(
  token: TreasuryToken,
  amount: string,
): { data: Hex; rawAmount: bigint } {
  const rawAmount = parseUnits(amount, TOKEN_DECIMALS);
  const data = encodeFunctionData({
    abi: kiteTreasuryAbi,
    functionName: 'deposit',
    args: [tokenAddress(token), rawAmount],
  });
  return { data, rawAmount };
}

/** Build call data for `KiteTreasury.withdraw(token, amount)`. */
export function encodeTreasuryWithdraw(
  token: TreasuryToken,
  amount: string,
): { data: Hex; rawAmount: bigint } {
  const rawAmount = parseUnits(amount, TOKEN_DECIMALS);
  const data = encodeFunctionData({
    abi: kiteTreasuryAbi,
    functionName: 'withdraw',
    args: [tokenAddress(token), rawAmount],
  });
  return { data, rawAmount };
}
