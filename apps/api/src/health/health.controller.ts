import { Controller, Get, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ViemService } from '../chain/viem.service';
import type { Env } from '../config/env';

@Controller('health')
export class HealthController {
  private readonly log = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly viem: ViemService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  async check() {
    const result: Record<string, unknown> = {
      status: 'ok',
      service: 'kite-api',
      env: this.config.get('NODE_ENV', { infer: true }),
      time: new Date().toISOString(),
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      result.db = 'ok';
    } catch (err) {
      result.db = 'error';
      result.dbError = (err as Error).message;
      result.status = 'degraded';
    }

    try {
      const block = await this.viem.publicClient.getBlockNumber();
      result.chain = 'ok';
      result.blockHeight = Number(block);
    } catch (err) {
      result.chain = 'error';
      result.chainError = (err as Error).message;
      result.status = 'degraded';
    }

    return result;
  }
}
