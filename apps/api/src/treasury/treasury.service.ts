import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Address, formatUnits, getAddress } from 'viem';
import type { Env } from '../config/env';
import { erc20Abi } from '../chain/abis/erc20';
import { kiteTreasuryAbi } from '../chain/abis/kite-treasury';
import { ViemService } from '../chain/viem.service';

const USDC_DECIMALS = 6;
const EURC_DECIMALS = 6;
const BPS_DENOM = 10_000n;
const BALANCE_CACHE_TTL_MS = 8_000;

type CachedBalance = { value: unknown; expiresAt: number };

@Injectable()
export class TreasuryService {
  private readonly log = new Logger(TreasuryService.name);
  private readonly treasury: Address;
  private readonly usdc: Address;
  private readonly eurc: Address;
  /**
   * Short TTL cache so 3 devices polling `useBalance` every 10 s don't all
   * fan out to RPC. Also dedupes in-flight requests (single multicall per
   * address per TTL window).
   */
  private readonly balanceCache = new Map<string, CachedBalance>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly viem: ViemService,
    config: ConfigService<Env, true>,
  ) {
    this.treasury = getAddress(
      config.get('KITE_TREASURY_ADDRESS', { infer: true }),
    );
    this.usdc = getAddress(
      config.get('USDC_ADDRESS_BASE_SEPOLIA', { infer: true }),
    );
    this.eurc = getAddress(
      config.get('EURC_ADDRESS_BASE_SEPOLIA', { infer: true }),
    );
  }

  async getInfo() {
    const [apyBps, usdcOnChain, eurcOnChain] = await Promise.all([
      this.viem.publicClient.readContract({
        address: this.treasury,
        abi: kiteTreasuryAbi,
        functionName: 'APY_BPS',
      }),
      this.viem.publicClient.readContract({
        address: this.treasury,
        abi: kiteTreasuryAbi,
        functionName: 'usdc',
      }),
      this.viem.publicClient.readContract({
        address: this.treasury,
        abi: kiteTreasuryAbi,
        functionName: 'eurc',
      }),
    ]);

    const apy = Number(apyBps) / Number(BPS_DENOM);
    return {
      treasuryAddress: this.treasury,
      usdcAddress: usdcOnChain,
      eurcAddress: eurcOnChain,
      expectedUsdcAddress: this.usdc,
      expectedEurcAddress: this.eurc,
      apy: {
        bps: Number(apyBps),
        decimal: apy,
        percent: `${(apy * 100).toFixed(2)}%`,
      },
    };
  }

  async getBalance(walletAddress: string) {
    const user = getAddress(walletAddress);
    const cacheKey = user.toLowerCase();
    const now = Date.now();

    const cached = this.balanceCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const pending = this.inFlight.get(cacheKey);
    if (pending) return pending;

    const promise = this.fetchBalance(user).finally(() => {
      this.inFlight.delete(cacheKey);
    });
    this.inFlight.set(cacheKey, promise);
    const value = await promise;
    this.balanceCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + BALANCE_CACHE_TTL_MS,
    });
    return value;
  }

  private async fetchBalance(user: Address) {
    const calls = [
      // 0..2: USDC treasury position
      {
        address: this.treasury,
        abi: kiteTreasuryAbi,
        functionName: 'principalOf',
        args: [this.usdc, user],
      },
      {
        address: this.treasury,
        abi: kiteTreasuryAbi,
        functionName: 'pendingYield',
        args: [this.usdc, user],
      },
      {
        address: this.treasury,
        abi: kiteTreasuryAbi,
        functionName: 'balanceOf',
        args: [this.usdc, user],
      },
      // 3..5: EURC treasury position
      {
        address: this.treasury,
        abi: kiteTreasuryAbi,
        functionName: 'principalOf',
        args: [this.eurc, user],
      },
      {
        address: this.treasury,
        abi: kiteTreasuryAbi,
        functionName: 'pendingYield',
        args: [this.eurc, user],
      },
      {
        address: this.treasury,
        abi: kiteTreasuryAbi,
        functionName: 'balanceOf',
        args: [this.eurc, user],
      },
      // 6..7: spendable wallet balances
      {
        address: this.usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [user],
      },
      {
        address: this.eurc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [user],
      },
    ] as const;

    const [
      usdcPrincipal,
      usdcPending,
      usdcTotal,
      eurcPrincipal,
      eurcPending,
      eurcTotal,
      walletUsdc,
      walletEurc,
    ] = await this.viem.publicClient.multicall({
      contracts: calls as unknown as typeof calls,
      allowFailure: false,
    });

    const usdcTreasury = {
      principal: this.format(usdcPrincipal as bigint, USDC_DECIMALS),
      accruedYield: this.format(usdcPending as bigint, USDC_DECIMALS),
      total: this.format(usdcTotal as bigint, USDC_DECIMALS),
    };
    const eurcTreasury = {
      principal: this.format(eurcPrincipal as bigint, EURC_DECIMALS),
      accruedYield: this.format(eurcPending as bigint, EURC_DECIMALS),
      total: this.format(eurcTotal as bigint, EURC_DECIMALS),
    };

    // `treasury.*` retained at the top of the per-token object for backward
    // compatibility with the v1 mobile build (Home reads
    // `treasury.total.formatted` / `treasury.accruedYield.formatted`). Both
    // aliases point at the USDC position so the existing call sites keep
    // working while the new fields (`treasury.usdc.*`, `treasury.eurc.*`)
    // land in the mobile UI.
    return {
      address: user,
      walletUsdc: this.format(walletUsdc as bigint, USDC_DECIMALS),
      walletEurc: this.format(walletEurc as bigint, EURC_DECIMALS),
      treasury: {
        ...usdcTreasury,
        usdc: usdcTreasury,
        eurc: eurcTreasury,
      },
    };
  }

  private format(raw: bigint, decimals: number) {
    return {
      raw: raw.toString(),
      formatted: formatUnits(raw, decimals),
    };
  }
}
