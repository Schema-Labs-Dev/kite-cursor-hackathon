import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TxStatus, TxType } from '@prisma/client';
import {
  Address,
  createWalletClient,
  encodeFunctionData,
  fallback,
  getAddress,
  http,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

import { ViemService } from '../chain/viem.service';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../auth/jwt.strategy';
import {
  MAX_ZMW,
  MIN_ZMW,
  OnrampMethod,
  OnrampToken,
  SimulateOnrampDto,
} from './dto/simulate-onramp.dto';

const TOKEN_DECIMALS = 6;

/** Single source of truth for ZMW → token. Mirrored in `apps/mobile/lib/onramp.ts`. */
const RATES_ZMW_PER_TOKEN: Record<OnrampToken, number> = {
  USDC: 27.0,
  EURC: 29.5,
};

const METHOD_LABELS: Record<OnrampMethod, string> = {
  airtel: 'Airtel Money',
  mtn: 'MTN Money',
  card: 'Card',
};

/** Reject mobile clients showing a rate that drifted >2% from ours. */
const MAX_RATE_DRIFT = 0.02;

/** Cosmetic delay so "talking to provider" feels real before we broadcast. */
const PROVIDER_DELAY_MS = 1_500;

const MINT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export type SimulateOnrampResult = {
  txHash: `0x${string}`;
  token: OnrampToken;
  tokenAmount: string;
  rawAmount: string;
  amountKwacha: number;
  rate: number;
  method: OnrampMethod;
  methodLabel: string;
  settledMs: number;
  blockNumber: number;
};

@Injectable()
export class OnrampService {
  private readonly log = new Logger(OnrampService.name);
  private readonly admin;
  private readonly walletClient;
  private readonly tokenAddresses: Record<OnrampToken, Address>;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly viem: ViemService,
    private readonly prisma: PrismaService,
  ) {
    const adminPk =
      this.config.get('ADMIN_PRIVATE_KEY', { infer: true }) ??
      this.config.get('PRIVATE_KEY', { infer: true });

    if (!adminPk) {
      this.log.warn(
        'No ADMIN_PRIVATE_KEY / PRIVATE_KEY set — onramp will reject all requests until one is provided.',
      );
      this.admin = null;
      this.walletClient = null;
    } else {
      this.admin = privateKeyToAccount(adminPk as `0x${string}`);
      this.log.log(`Onramp admin wallet: ${this.admin.address}`);

      // Reuse the same RPC topology as ViemService — Alchemy preferred,
      // public Base Sepolia as fallback. We can't share the publicClient
      // transport directly (it's a fallback), but rebuilding with the
      // same key gets identical behaviour for writes.
      const alchemyKey = this.config.get('ALCHEMY_API_KEY', { infer: true });
      const publicUrl = this.config.get('BASE_SEPOLIA_RPC_URL', { infer: true });
      const transports = alchemyKey
        ? [
            http(`https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`, {
              retryCount: 1,
              timeout: 8_000,
            }),
            http(publicUrl, { retryCount: 1, timeout: 8_000 }),
          ]
        : [http(publicUrl, { retryCount: 2, timeout: 8_000 })];

      this.walletClient = createWalletClient({
        account: this.admin,
        chain: baseSepolia,
        transport: fallback(transports, { rank: false }),
      });
    }

    this.tokenAddresses = {
      USDC: getAddress(
        this.config.get('USDC_ADDRESS_BASE_SEPOLIA', { infer: true }),
      ),
      EURC: getAddress(
        this.config.get('EURC_ADDRESS_BASE_SEPOLIA', { infer: true }),
      ),
    };
  }

  async simulate(
    user: RequestUser,
    body: SimulateOnrampDto,
  ): Promise<SimulateOnrampResult> {
    if (!this.admin || !this.walletClient) {
      throw new InternalServerErrorException(
        'Onramp not configured: missing ADMIN_PRIVATE_KEY (or PRIVATE_KEY).',
      );
    }

    this.assertMethodInputs(body);
    if (body.amountKwacha < MIN_ZMW || body.amountKwacha > MAX_ZMW) {
      throw new BadRequestException(
        `amountKwacha must be between ${MIN_ZMW} and ${MAX_ZMW}`,
      );
    }

    const rate = RATES_ZMW_PER_TOKEN[body.token];
    if (typeof body.claimedRate === 'number' && body.claimedRate > 0) {
      const drift = Math.abs(body.claimedRate - rate) / rate;
      if (drift > MAX_RATE_DRIFT) {
        throw new BadRequestException(
          `Rate drift too large (${(drift * 100).toFixed(2)}%) — refresh and retry.`,
        );
      }
    }

    const tokenAmountFloat = body.amountKwacha / rate;
    // 6 decimals — round to 6dp string before parseUnits to avoid binary slop.
    const tokenAmountStr = tokenAmountFloat.toFixed(TOKEN_DECIMALS);
    const rawAmount = parseUnits(tokenAmountStr, TOKEN_DECIMALS);
    const methodLabel = METHOD_LABELS[body.method];

    this.log.log(
      `Onramp · user=${user.walletAddress} · ${methodLabel} · ZMW ${body.amountKwacha} → ${tokenAmountStr} ${body.token} (rate ${rate})`,
    );

    // Cosmetic "talking to Airtel/MTN/Card" delay.
    await new Promise((r) => setTimeout(r, PROVIDER_DELAY_MS));
    this.log.log(`Provider confirmed (simulated) — broadcasting mint…`);

    const tokenAddr = this.tokenAddresses[body.token];
    const data = encodeFunctionData({
      abi: MINT_ABI,
      functionName: 'mint',
      args: [getAddress(user.walletAddress), rawAmount],
    });

    const start = Date.now();
    let txHash: `0x${string}`;
    try {
      txHash = await this.walletClient.sendTransaction({
        to: tokenAddr,
        data,
        chain: baseSepolia,
        account: this.admin,
      });
    } catch (err) {
      const msg = (err as Error).message;
      this.log.error(`Mint broadcast failed: ${msg}`);
      throw new InternalServerErrorException(`Mint failed: ${msg}`);
    }
    this.log.log(`Mint broadcast · ${txHash}`);

    let blockNumber = 0;
    try {
      const receipt = await this.viem.publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      blockNumber = Number(receipt.blockNumber);
      this.log.log(
        `Mint receipt · block ${blockNumber} · status ${receipt.status} · gas ${receipt.gasUsed}`,
      );
    } catch (err) {
      this.log.warn(
        `Receipt wait failed (tx still broadcast): ${(err as Error).message}`,
      );
    }
    const settledMs = Date.now() - start;

    // Pre-tag the tx so Activity shows "Added via Airtel Money" right away,
    // even before the indexer catches up. Mirrors the upsert shape in
    // TransactionsService.attachMemo, but inlined (no second HTTP round-trip).
    const memo = `Added via ${methodLabel}`;
    try {
      await this.prisma.transaction.upsert({
        where: { txHash },
        update: {
          memo,
          status: blockNumber > 0 ? TxStatus.CONFIRMED : TxStatus.PENDING,
          ...(blockNumber > 0 ? { blockNumber } : {}),
          token: body.token,
          toUserId: user.id,
        },
        create: {
          txHash,
          // Mint = Transfer(from=0x0…, to=user). Match what the indexer will
          // record so the row de-dupes cleanly on its first pass.
          fromAddress: '0x0000000000000000000000000000000000000000',
          toAddress: user.walletAddress.toLowerCase(),
          fromUserId: null,
          toUserId: user.id,
          amount: rawAmount.toString(),
          token: body.token,
          txType: TxType.TRANSFER,
          status: blockNumber > 0 ? TxStatus.CONFIRMED : TxStatus.PENDING,
          memo,
          blockNumber,
        },
      });
      this.log.log(`Tagged tx ${txHash} with memo "${memo}"`);
    } catch (err) {
      this.log.warn(
        `Memo upsert failed (ignored): ${(err as Error).message}`,
      );
    }

    return {
      txHash,
      token: body.token,
      tokenAmount: tokenAmountStr,
      rawAmount: rawAmount.toString(),
      amountKwacha: body.amountKwacha,
      rate,
      method: body.method,
      methodLabel,
      settledMs,
      blockNumber,
    };
  }

  private assertMethodInputs(body: SimulateOnrampDto): void {
    if ((body.method === 'airtel' || body.method === 'mtn') && !body.phone) {
      throw new BadRequestException(`phone is required for ${body.method}`);
    }
    if (body.method === 'card' && !body.cardLast4) {
      throw new BadRequestException('cardLast4 is required for card');
    }
  }
}
