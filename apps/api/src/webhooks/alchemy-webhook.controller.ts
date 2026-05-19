import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { TxStatus, TxType } from '@prisma/client';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

type AlchemyActivity = {
  fromAddress: string;
  toAddress: string;
  blockNum: string;
  hash: string;
  value?: number;
  asset?: string;
  category?: string;
  rawContract?: {
    rawValue?: string;
    address?: string;
    decimals?: number;
  };
};

type AlchemyPayload = {
  webhookId?: string;
  id?: string;
  type?: string;
  event?: {
    network?: string;
    activity?: AlchemyActivity[];
  };
};

@Controller('webhooks')
export class AlchemyWebhookController {
  private readonly log = new Logger(AlchemyWebhookController.name);
  private readonly signingKey?: string;
  private readonly usdcAddress: string;
  private readonly treasuryAddress: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.signingKey = config.get('ALCHEMY_WEBHOOK_SIGNING_KEY', {
      infer: true,
    });
    this.usdcAddress = config
      .get('USDC_ADDRESS_BASE_SEPOLIA', { infer: true })
      .toLowerCase();
    this.treasuryAddress = config
      .get('KITE_TREASURY_ADDRESS', { infer: true })
      .toLowerCase();
  }

  @Post('alchemy')
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-alchemy-signature') signature: string | undefined,
  ) {
    if (!this.signingKey) {
      // Disabled — silently accept so the dashboard "test" button doesn't
      // 5xx, but log so we notice if we forgot to configure.
      this.log.warn(
        'Webhook hit but ALCHEMY_WEBHOOK_SIGNING_KEY is unset — ignoring.',
      );
      return { received: false, reason: 'disabled' };
    }
    if (!req.rawBody) {
      throw new UnauthorizedException('Missing raw body');
    }
    if (!signature || !this.verify(signature, req.rawBody)) {
      throw new UnauthorizedException('Bad signature');
    }

    const payload = parsePayload(req.body);
    const activities = payload.event?.activity ?? [];
    if (activities.length === 0) {
      return { received: true, processed: 0 };
    }

    const processed = await this.processActivities(activities);
    return { received: true, processed };
  }

  private verify(headerSig: string, raw: Buffer): boolean {
    const expected = createHmac('sha256', this.signingKey!)
      .update(raw)
      .digest('hex');
    const a = Buffer.from(headerSig, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async processActivities(
    activities: AlchemyActivity[],
  ): Promise<number> {
    // Only USDC token transfers. Treasury Deposited/Withdrawn events still
    // come through the polling indexer (Address Activity reports them as
    // plain USDC transfers, but they're already handled there with richer
    // typing).
    const relevant = activities.filter((a) => {
      if (a.category !== 'token') return false;
      const token = a.rawContract?.address?.toLowerCase();
      if (token !== this.usdcAddress) return false;
      const from = a.fromAddress.toLowerCase();
      const to = a.toAddress.toLowerCase();
      // Skip pure Treasury legs — handled as DEPOSIT/WITHDRAW by polling.
      if (from === this.treasuryAddress || to === this.treasuryAddress) {
        return false;
      }
      return true;
    });

    if (relevant.length === 0) return 0;

    // Hydrate userId for any participants we recognise.
    const addresses = Array.from(
      new Set(
        relevant.flatMap((a) => [
          a.fromAddress.toLowerCase(),
          a.toAddress.toLowerCase(),
        ]),
      ),
    );
    const users = await this.prisma.user.findMany({
      where: { walletAddress: { in: addresses } },
      select: { id: true, walletAddress: true },
    });
    const userByAddress = new Map(
      users.map((u) => [u.walletAddress.toLowerCase(), u.id]),
    );

    let written = 0;
    for (const a of relevant) {
      const from = a.fromAddress.toLowerCase();
      const to = a.toAddress.toLowerCase();
      const fromUserId = userByAddress.get(from);
      const toUserId = userByAddress.get(to);
      if (!fromUserId && !toUserId) continue;

      const amount = decodeAmount(a);
      if (amount === null) continue;
      const blockNumber = Number(BigInt(a.blockNum));

      await this.prisma.transaction.upsert({
        where: { txHash: a.hash },
        update: {
          blockNumber,
          status: TxStatus.CONFIRMED,
          ...(fromUserId ? { fromUserId } : {}),
          ...(toUserId ? { toUserId } : {}),
        },
        create: {
          txHash: a.hash,
          fromAddress: from,
          toAddress: to,
          fromUserId,
          toUserId,
          amount,
          token: 'USDC',
          txType: TxType.TRANSFER,
          status: TxStatus.CONFIRMED,
          blockNumber,
        },
      });
      written += 1;
    }

    this.log.log(
      `Alchemy webhook processed ${written}/${activities.length} activities`,
    );
    return written;
  }
}

function parsePayload(raw: unknown): AlchemyPayload {
  if (typeof raw === 'object' && raw !== null) return raw as AlchemyPayload;
  return {};
}

/** Prefer the raw uint when present; fall back to value × 10^decimals. */
function decodeAmount(a: AlchemyActivity): string | null {
  const raw = a.rawContract?.rawValue;
  if (raw && /^0x[0-9a-fA-F]+$/.test(raw)) {
    try {
      return BigInt(raw).toString();
    } catch {
      // fallthrough
    }
  }
  if (typeof a.value === 'number' && Number.isFinite(a.value)) {
    const decimals = a.rawContract?.decimals ?? 6;
    const whole = BigInt(Math.round(a.value * 10 ** decimals));
    return whole.toString();
  }
  return null;
}

