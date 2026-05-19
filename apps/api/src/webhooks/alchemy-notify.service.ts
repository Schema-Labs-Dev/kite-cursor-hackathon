import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAddress } from 'viem';
import type { Env } from '../config/env';

const NOTIFY_BASE = 'https://dashboard.alchemy.com/api';

/**
 * Talks to Alchemy's Custom Webhook (Notify) admin API to keep the
 * Address Activity watchlist in sync with our users + the Treasury.
 *
 * Inactive (no-op) unless ALCHEMY_WEBHOOK_ID + ALCHEMY_NOTIFY_AUTH_TOKEN are set.
 */
@Injectable()
export class AlchemyNotifyService implements OnModuleInit {
  private readonly log = new Logger(AlchemyNotifyService.name);
  private readonly webhookId?: string;
  private readonly authToken?: string;
  private readonly treasuryAddress: string;

  constructor(config: ConfigService<Env, true>) {
    this.webhookId = config.get('ALCHEMY_WEBHOOK_ID', { infer: true });
    this.authToken = config.get('ALCHEMY_NOTIFY_AUTH_TOKEN', { infer: true });
    this.treasuryAddress = config.get('KITE_TREASURY_ADDRESS', { infer: true });
  }

  get isEnabled(): boolean {
    return Boolean(this.webhookId && this.authToken);
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled) {
      this.log.log('Alchemy Notify disabled (no webhook id / auth token).');
      return;
    }
    try {
      await this.addAddresses([this.treasuryAddress]);
      this.log.log(
        `Alchemy Notify ready — Treasury ${this.treasuryAddress} added to webhook ${this.webhookId}.`,
      );
    } catch (err) {
      this.log.warn(
        `Failed to seed Treasury address into Alchemy webhook: ${(err as Error).message}`,
      );
    }
  }

  /** Idempotent — Alchemy ignores duplicates. */
  async addAddresses(addresses: string[]): Promise<void> {
    if (!this.isEnabled || addresses.length === 0) return;
    const checksummed = addresses.map((a) => getAddress(a));
    await this.patch({ addresses_to_add: checksummed, addresses_to_remove: [] });
  }

  async removeAddresses(addresses: string[]): Promise<void> {
    if (!this.isEnabled || addresses.length === 0) return;
    const checksummed = addresses.map((a) => getAddress(a));
    await this.patch({ addresses_to_add: [], addresses_to_remove: checksummed });
  }

  private async patch(body: {
    addresses_to_add: string[];
    addresses_to_remove: string[];
  }): Promise<void> {
    const res = await fetch(`${NOTIFY_BASE}/update-webhook-addresses`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'X-Alchemy-Token': this.authToken!,
      },
      body: JSON.stringify({ webhook_id: this.webhookId, ...body }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Alchemy Notify ${res.status}: ${text}`);
    }
  }
}
