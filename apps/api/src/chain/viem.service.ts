import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, fallback, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { Env } from '../config/env';

/**
 * Wraps a viem PublicClient configured for the chain we run on.
 * All chain reads (balance, indexer logs, treasury reads) flow through here.
 *
 * Transport: viem's `fallback` — tries Alchemy first (when configured), then
 * the public Base Sepolia RPC. If Alchemy 429s, returns plaintext junk for an
 * un-enabled network, or is otherwise unreachable, requests automatically
 * retry against the public endpoint. Mobile never sees a 500.
 */
@Injectable()
export class ViemService implements OnModuleInit {
  private readonly log = new Logger(ViemService.name);
  readonly publicClient;
  readonly rpcKind: 'alchemy+public' | 'public';

  constructor(private readonly config: ConfigService<Env, true>) {
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

    this.rpcKind = alchemyKey ? 'alchemy+public' : 'public';
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: fallback(transports, { rank: false }),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const block = await this.publicClient.getBlockNumber();
      this.log.log(
        `Connected to Base Sepolia via ${this.rpcKind} transport at block ${block}`,
      );
    } catch (err) {
      this.log.warn(`Chain connection failed: ${(err as Error).message}`);
    }
  }
}
