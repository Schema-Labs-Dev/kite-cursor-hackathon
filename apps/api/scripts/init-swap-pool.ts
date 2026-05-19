/**
 * One-shot pool creation + liquidity seeding for the USDC/EURC pair on the
 * Base Sepolia Uniswap V3 deployment. Run once with a wallet that holds both
 * tokens (from https://faucet.circle.com) plus a little Sepolia ETH for gas.
 *
 *   pnpm --filter @kite/api pool init \
 *     --usdc 50 --eurc 46 --rate 1.0875
 *
 * Args:
 *   --usdc <decimal>   USDC to seed (default 50)
 *   --eurc <decimal>   EURC to seed (default 46)
 *   --rate <decimal>   USDC per 1 EURC (default 1.0875).
 *                      Pool is initialised to this price; the seeded amounts
 *                      should match it (rate × eurc ≈ usdc) for symmetric
 *                      depth.
 *
 * Re-running is safe: if the pool already exists at the requested fee tier
 * we skip the create step and just mint additional liquidity.
 */

import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  fallback,
  formatUnits,
  http,
  parseAbi,
  parseUnits,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const FACTORY: Address = '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24';
const NFPM: Address = '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2';
const FEE = 100; // 0.01 %
const TICK_SPACING = 1; // matches fee tier 100
const DECIMALS = 6;

// Full-range bounds for tickSpacing = 1 (TickMath.MIN_TICK / MAX_TICK rounded
// to the nearest spacing).
const MIN_TICK = -887272;
const MAX_TICK = 887272;

const factoryAbi = parseAbi([
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)',
]);

const nfpmAbi = parseAbi([
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)',
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
]);

const erc20Abi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
]);

function fatal(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function argv(name: string, fallback?: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return fallback ?? '';
}

/**
 * sqrtPriceX96 = floor(sqrt(price) * 2^96), where price = token1 / token0
 * for the chosen ordering.
 */
function sqrtPriceX96(price: number): bigint {
  // Use float sqrt then scale — precision is fine for testnet pool init.
  const root = Math.sqrt(price);
  const Q96 = 2 ** 96;
  return BigInt(Math.floor(root * Q96));
}

async function main() {
  const usdcInput = parseFloat(argv('usdc', '50'));
  const eurcInput = parseFloat(argv('eurc', '46'));
  const rate = parseFloat(argv('rate', '1.0875')); // USDC per 1 EURC
  if (!Number.isFinite(usdcInput) || !Number.isFinite(eurcInput) || !Number.isFinite(rate)) {
    fatal('Invalid --usdc / --eurc / --rate value.');
  }

  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    fatal(
      'PRIVATE_KEY missing from apps/api/.env. Add a Sepolia EOA private key (with ETH + USDC + EURC) and re-run.',
    );
  }
  const usdcAddr = (process.env.USDC_ADDRESS_BASE_SEPOLIA ?? '').toLowerCase();
  const eurcAddr = (process.env.EURC_ADDRESS_BASE_SEPOLIA ?? '').toLowerCase();
  if (!usdcAddr || !eurcAddr) {
    fatal('USDC_ADDRESS_BASE_SEPOLIA / EURC_ADDRESS_BASE_SEPOLIA missing.');
  }

  // Free-tier Alchemy 429s aggressively; pool init does ~10 reads + 3 writes
  // and we'd rather not have a single 429 brick the whole run. Public RPC
  // first, Alchemy as fallback when configured.
  const publicRpc = process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';
  const alchemyRpc = process.env.ALCHEMY_API_KEY
    ? `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : null;
  const transport = fallback(
    alchemyRpc
      ? [http(publicRpc, { retryCount: 2 }), http(alchemyRpc, { retryCount: 1 })]
      : [http(publicRpc, { retryCount: 2 })],
    { rank: false },
  );

  const account = privateKeyToAccount(pk as `0x${string}`);
  const publicClient = createPublicClient({ chain: baseSepolia, transport });
  const wallet = createWalletClient({ chain: baseSepolia, transport, account });

  // Uniswap orders tokens by address (token0 = lower). Compute the per-pool
  // direction so the price scalar is consistent.
  const isUsdcToken0 = usdcAddr < eurcAddr;
  const token0 = (isUsdcToken0 ? usdcAddr : eurcAddr) as Address;
  const token1 = (isUsdcToken0 ? eurcAddr : usdcAddr) as Address;

  // Price needs to be token1 / token0. The user gives us "USDC per 1 EURC";
  // translate:
  //   If USDC=token0, EURC=token1 → price = EURC/USDC = 1/rate
  //   Otherwise                   → price = USDC/EURC = rate
  const pricePoolUnits = isUsdcToken0 ? 1 / rate : rate;
  const sqrtPrice = sqrtPriceX96(pricePoolUnits);

  console.log('Pool init plan:');
  console.log(`  token0   ${token0} (${isUsdcToken0 ? 'USDC' : 'EURC'})`);
  console.log(`  token1   ${token1} (${isUsdcToken0 ? 'EURC' : 'USDC'})`);
  console.log(`  fee      ${FEE} (0.01%)`);
  console.log(`  rate     1 EURC = ${rate} USDC`);
  console.log(`  sqrtPriceX96 ${sqrtPrice}`);
  console.log(`  seed     ${usdcInput} USDC + ${eurcInput} EURC`);
  console.log(`  recipient ${account.address}\n`);

  // 1. Pool — create-or-skip.
  const existing = await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: 'getPool',
    args: [token0, token1, FEE],
  });
  const POOL_ZERO: Address = '0x0000000000000000000000000000000000000000';
  if (existing === POOL_ZERO) {
    console.log('Pool does not exist — creating + initializing...');
    const hash = await wallet.writeContract({
      address: NFPM,
      abi: nfpmAbi,
      functionName: 'createAndInitializePoolIfNecessary',
      args: [token0, token1, FEE, sqrtPrice],
    });
    console.log(`  tx ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    const after = await publicClient.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: 'getPool',
      args: [token0, token1, FEE],
    });
    console.log(`✓ Pool deployed at ${after}\n`);
  } else {
    console.log(`Pool already exists at ${existing} — skipping init.\n`);
  }

  // 2. Balance + allowance check for both tokens.
  const usdcRaw = parseUnits(String(usdcInput), DECIMALS);
  const eurcRaw = parseUnits(String(eurcInput), DECIMALS);

  for (const [addr, raw, sym] of [
    [usdcAddr as Address, usdcRaw, 'USDC'],
    [eurcAddr as Address, eurcRaw, 'EURC'],
  ] as const) {
    const bal = await publicClient.readContract({
      address: addr,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    });
    if (bal < raw) {
      fatal(
        `Wallet ${account.address} has only ${formatUnits(bal, DECIMALS)} ${sym}; needs ${formatUnits(raw, DECIMALS)} ${sym}. Use https://faucet.circle.com.`,
      );
    }
    const allowance = await publicClient.readContract({
      address: addr,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, NFPM],
    });
    if (allowance < raw) {
      console.log(`Approving ${sym} → NFPM...`);
      const hash = await wallet.writeContract({
        address: addr,
        abi: erc20Abi,
        functionName: 'approve',
        args: [NFPM, raw],
      });
      console.log(`  tx ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
    }
  }

  // 3. Mint a full-range position. `amount0Desired` / `amount1Desired` go in
  //    token0/token1 order; min = 0 since we're the only LP (no slippage risk).
  const amount0Desired = isUsdcToken0 ? usdcRaw : eurcRaw;
  const amount1Desired = isUsdcToken0 ? eurcRaw : usdcRaw;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  console.log('Minting position...');
  const mintHash = await wallet.writeContract({
    address: NFPM,
    abi: nfpmAbi,
    functionName: 'mint',
    args: [
      {
        token0,
        token1,
        fee: FEE,
        tickLower: alignToSpacing(MIN_TICK),
        tickUpper: alignToSpacing(MAX_TICK),
        amount0Desired,
        amount1Desired,
        amount0Min: 0n,
        amount1Min: 0n,
        recipient: account.address,
        deadline,
      },
    ],
  });
  console.log(`  tx ${mintHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`✓ Liquidity minted in block ${receipt.blockNumber}\n`);

  const pool = await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: 'getPool',
    args: [token0, token1, FEE],
  });
  console.log(`Done. Pool: ${pool}`);
  console.log('Mobile app users can now Convert.');
}

function alignToSpacing(tick: number): number {
  return Math.trunc(tick / TICK_SPACING) * TICK_SPACING;
}

main().catch((err: unknown) => {
  fatal((err as Error).message);
});
