import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Prisma, TxType } from '@prisma/client';
import { Address, getAddress, parseAbiItem } from 'viem';
import type { Env } from '../config/env';
import { ViemService } from '../chain/viem.service';
import { PrismaService } from '../prisma/prisma.service';

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);
const DEPOSITED_EVENT = parseAbiItem(
  'event Deposited(address indexed user, address indexed token, uint256 amount, uint256 timestamp)',
);
const WITHDRAWN_EVENT = parseAbiItem(
  'event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 yieldPortion, uint256 timestamp)',
);

const CURSOR_NAME = 'main';
const TICK_INTERVAL_MS = 6_000;
const MAX_BLOCK_RANGE = 500n;
const INITIAL_LOOKBACK_BLOCKS = 200n;
/**
 * Stay this many blocks behind the reported head. The public sepolia.base.org
 * RPC is load-balanced and its `eth_blockNumber` is sometimes a few blocks
 * ahead of what `eth_getLogs` will accept (it'll return "block range extends
 * beyond current head"). Indexing only up to `head - margin` makes this
 * vanish in practice.
 */
const CONFIRMATION_MARGIN = 5n;

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly log = new Logger(IndexerService.name);
  private readonly usdc: Address;
  private readonly eurc: Address;
  private readonly treasury: Address;
  private readonly tokenSymbols: Map<string, 'USDC' | 'EURC'>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly viem: ViemService,
    config: ConfigService<Env, true>,
  ) {
    this.usdc = getAddress(
      config.get('USDC_ADDRESS_BASE_SEPOLIA', { infer: true }),
    );
    this.eurc = getAddress(
      config.get('EURC_ADDRESS_BASE_SEPOLIA', { infer: true }),
    );
    this.treasury = getAddress(
      config.get('KITE_TREASURY_ADDRESS', { infer: true }),
    );
    this.tokenSymbols = new Map<string, 'USDC' | 'EURC'>([
      [this.usdc.toLowerCase(), 'USDC'],
      [this.eurc.toLowerCase(), 'EURC'],
    ]);
  }

  async onModuleInit() {
    const existing = await this.prisma.indexerCursor.findUnique({
      where: { name: CURSOR_NAME },
    });
    if (!existing) {
      const head = await this.viem.publicClient.getBlockNumber();
      const start = head > INITIAL_LOOKBACK_BLOCKS ? head - INITIAL_LOOKBACK_BLOCKS : 0n;
      await this.prisma.indexerCursor.create({
        data: { name: CURSOR_NAME, lastBlock: Number(start) },
      });
      this.log.log(`Indexer initialized at block ${start}`);
    } else {
      this.log.log(`Indexer resuming from block ${existing.lastBlock}`);
    }
  }

  @Interval(TICK_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processOnce();
    } catch (err) {
      const msg = (err as Error).message;
      // Public RPC race: we asked for blocks the node hasn't seen yet. Don't
      // advance the cursor — the next tick retries the same range once the
      // node catches up.
      if (msg.includes('extends beyond current head')) {
        this.log.warn(
          'Indexer skipped tick: RPC head lagged behind eth_blockNumber. Will retry.',
        );
      } else {
        this.log.error(`Indexer tick failed: ${msg}`);
      }
    } finally {
      this.running = false;
    }
  }

  private async processOnce(): Promise<void> {
    const cursor = await this.prisma.indexerCursor.findUniqueOrThrow({
      where: { name: CURSOR_NAME },
    });
    const head = await this.viem.publicClient.getBlockNumber();
    const safeHead =
      head > CONFIRMATION_MARGIN ? head - CONFIRMATION_MARGIN : 0n;
    const fromBlock = BigInt(cursor.lastBlock + 1);
    if (fromBlock > safeHead) return;

    const toBlock =
      fromBlock + MAX_BLOCK_RANGE - 1n > safeHead
        ? safeHead
        : fromBlock + MAX_BLOCK_RANGE - 1n;

    const [usdcTransferLogs, eurcTransferLogs, depositLogs, withdrawLogs] =
      await Promise.all([
        this.viem.publicClient.getLogs({
          address: this.usdc,
          event: TRANSFER_EVENT,
          fromBlock,
          toBlock,
        }),
        this.viem.publicClient.getLogs({
          address: this.eurc,
          event: TRANSFER_EVENT,
          fromBlock,
          toBlock,
        }),
        this.viem.publicClient.getLogs({
          address: this.treasury,
          event: DEPOSITED_EVENT,
          fromBlock,
          toBlock,
        }),
        this.viem.publicClient.getLogs({
          address: this.treasury,
          event: WITHDRAWN_EVENT,
          fromBlock,
          toBlock,
        }),
      ]);

    const total =
      usdcTransferLogs.length +
      eurcTransferLogs.length +
      depositLogs.length +
      withdrawLogs.length;
    if (total === 0) {
      await this.advanceCursor(toBlock);
      return;
    }

    const users = await this.prisma.user.findMany({
      select: { id: true, walletAddress: true },
    });
    const userByAddress = new Map(users.map((u) => [u.walletAddress.toLowerCase(), u.id]));

    // Treasury legs (the inner ERC-20 transfer that accompanies a Deposit /
    // Withdraw) are skipped from the transfer-row writes so the user doesn't
    // see two rows for the same on-chain action.
    const treasuryHashes = new Set(
      [...depositLogs, ...withdrawLogs].map((l) => l.transactionHash.toLowerCase()),
    );

    const writes: Prisma.PrismaPromise<unknown>[] = [];

    const indexTransfers = (
      logs: typeof usdcTransferLogs,
      token: 'USDC' | 'EURC',
    ) => {
      for (const l of logs) {
        if (treasuryHashes.has(l.transactionHash.toLowerCase())) continue;
        const from = (l.args.from as string).toLowerCase();
        const to = (l.args.to as string).toLowerCase();
        const fromUserId = userByAddress.get(from);
        const toUserId = userByAddress.get(to);
        if (!fromUserId && !toUserId) continue;
        writes.push(
          this.upsertTx({
            txHash: l.transactionHash,
            fromAddress: from,
            toAddress: to,
            fromUserId,
            toUserId,
            amount: (l.args.value as bigint).toString(),
            token,
            txType: TxType.TRANSFER,
            blockNumber: Number(l.blockNumber),
          }),
        );
      }
    };

    indexTransfers(usdcTransferLogs, 'USDC');
    indexTransfers(eurcTransferLogs, 'EURC');

    for (const l of depositLogs) {
      const user = (l.args.user as string).toLowerCase();
      const token = (l.args.token as string).toLowerCase();
      const symbol = this.tokenSymbols.get(token);
      if (!symbol) continue; // unknown token — should not happen unless config drifts
      const userId = userByAddress.get(user);
      writes.push(
        this.upsertTx({
          txHash: l.transactionHash,
          fromAddress: user,
          toAddress: this.treasury.toLowerCase(),
          fromUserId: userId,
          toUserId: undefined,
          amount: (l.args.amount as bigint).toString(),
          token: symbol,
          txType: TxType.TREASURY_DEPOSIT,
          blockNumber: Number(l.blockNumber),
        }),
      );
    }

    for (const l of withdrawLogs) {
      const user = (l.args.user as string).toLowerCase();
      const token = (l.args.token as string).toLowerCase();
      const symbol = this.tokenSymbols.get(token);
      if (!symbol) continue;
      const userId = userByAddress.get(user);
      writes.push(
        this.upsertTx({
          txHash: l.transactionHash,
          fromAddress: this.treasury.toLowerCase(),
          toAddress: user,
          fromUserId: undefined,
          toUserId: userId,
          amount: (l.args.amount as bigint).toString(),
          token: symbol,
          txType: TxType.TREASURY_WITHDRAW,
          blockNumber: Number(l.blockNumber),
        }),
      );
    }

    if (writes.length > 0) {
      await this.prisma.$transaction([
        ...writes,
        this.prisma.indexerCursor.update({
          where: { name: CURSOR_NAME },
          data: { lastBlock: Number(toBlock) },
        }),
      ]);
      this.log.log(
        `Indexed blocks ${fromBlock}..${toBlock} -> persisted ${writes.length} txs ` +
          `(${usdcTransferLogs.length} USDC transfers, ${eurcTransferLogs.length} EURC transfers, ` +
          `${depositLogs.length} deposits, ${withdrawLogs.length} withdraws)`,
      );
    } else {
      await this.advanceCursor(toBlock);
    }
  }

  private upsertTx(data: {
    txHash: string;
    fromAddress: string;
    toAddress: string;
    fromUserId?: string;
    toUserId?: string;
    amount: string;
    token: string;
    txType: TxType;
    blockNumber: number;
  }) {
    return this.prisma.transaction.upsert({
      where: { txHash: data.txHash },
      // Backfill fields that the memo POST may have left blank when it
      // pre-created a PENDING placeholder. `memo` is left alone.
      update: {
        blockNumber: data.blockNumber,
        status: 'CONFIRMED',
        token: data.token,
        ...(data.fromUserId ? { fromUserId: data.fromUserId } : {}),
        ...(data.toUserId ? { toUserId: data.toUserId } : {}),
      },
      create: data,
    });
  }

  private async advanceCursor(toBlock: bigint) {
    await this.prisma.indexerCursor.update({
      where: { name: CURSOR_NAME },
      data: { lastBlock: Number(toBlock) },
    });
  }
}
