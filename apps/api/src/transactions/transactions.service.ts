import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transaction, TxStatus, TxType, User } from '@prisma/client';
import { formatUnits } from 'viem';
import type { Env } from '../config/env';
import type { RequestUser } from '../auth/jwt.strategy';
import { AttachMemoDto } from './dto/attach-memo.dto';
import { PrismaService } from '../prisma/prisma.service';

const USDC_DECIMALS = 6;

type CounterpartyUser = Pick<
  User,
  'id' | 'walletAddress' | 'basename' | 'displayName' | 'avatarUrl'
>;

type TxWithUsers = Transaction & {
  fromUser: CounterpartyUser | null;
  toUser: CounterpartyUser | null;
};

@Injectable()
export class TransactionsService {
  private readonly treasuryAddress: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.treasuryAddress = config
      .get('KITE_TREASURY_ADDRESS', { infer: true })
      .toLowerCase();
  }

  async attachMemo(user: RequestUser, body: AttachMemoDto) {
    const txHash = body.txHash;
    const toAddress = body.toAddress.toLowerCase();
    const fromAddress = user.walletAddress.toLowerCase();

    const toUser = await this.prisma.user.findUnique({
      where: { walletAddress: toAddress },
      select: { id: true },
    });

    const row = await this.prisma.transaction.upsert({
      where: { txHash },
      update: {
        memo: body.memo ?? null,
      },
      create: {
        txHash,
        fromAddress,
        toAddress,
        fromUserId: user.id,
        toUserId: toUser?.id,
        amount: body.amount,
        token: 'USDC',
        txType: TxType.TRANSFER,
        status: TxStatus.PENDING,
        memo: body.memo ?? null,
        blockNumber: 0,
      },
      select: { id: true, status: true },
    });

    return { id: row.id, status: row.status };
  }

  async getByIdForUser(viewerId: string, id: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: {
        id,
        OR: [{ fromUserId: viewerId }, { toUserId: viewerId }],
      },
      include: {
        fromUser: {
          select: {
            id: true,
            walletAddress: true,
            basename: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        toUser: {
          select: {
            id: true,
            walletAddress: true,
            basename: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
    if (!tx) return null;
    return this.shape(tx as TxWithUsers, viewerId);
  }

  async listForUser(userId: string, cursor: string | undefined, limit = 20) {
    const items = await this.prisma.transaction.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        fromUser: {
          select: {
            id: true,
            walletAddress: true,
            basename: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        toUser: {
          select: {
            id: true,
            walletAddress: true,
            basename: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = items.length > limit;
    const page = (hasMore ? items.slice(0, limit) : items) as TxWithUsers[];
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return {
      items: page.map((tx) => this.shape(tx, userId)),
      nextCursor,
    };
  }

  private shape(tx: TxWithUsers, viewerId: string) {
    const isOut = tx.fromUserId === viewerId;
    const direction =
      tx.txType === TxType.TREASURY_DEPOSIT
        ? 'OUT'
        : tx.txType === TxType.TREASURY_WITHDRAW
          ? 'IN'
          : isOut
            ? 'OUT'
            : 'IN';
    const displayKind =
      tx.txType === TxType.TREASURY_DEPOSIT
        ? 'deposit'
        : tx.txType === TxType.TREASURY_WITHDRAW
          ? 'withdraw'
          : direction === 'OUT'
            ? 'send'
            : 'receive';

    return {
      id: tx.id,
      txHash: tx.txHash,
      type: tx.txType,
      direction,
      displayKind,
      status: tx.status,
      amount: {
        raw: tx.amount,
        formatted: formatUnits(BigInt(tx.amount), USDC_DECIMALS),
      },
      token: tx.token,
      memo: tx.memo,
      blockNumber: tx.blockNumber,
      createdAt: tx.createdAt,
      counterparty: this.counterparty(tx, viewerId),
    };
  }

  private counterparty(tx: TxWithUsers, viewerId: string) {
    if (
      tx.txType === TxType.TREASURY_DEPOSIT ||
      tx.txType === TxType.TREASURY_WITHDRAW
    ) {
      return {
        kind: 'TREASURY' as const,
        address: this.treasuryAddress,
        shortAddress: shortAddr(this.treasuryAddress),
        displayName: 'Kite Treasury',
        basename: null,
        avatarUrl: null,
      };
    }

    const isOut = tx.fromUserId === viewerId;
    const counterUser = isOut ? tx.toUser : tx.fromUser;
    const counterAddress = isOut ? tx.toAddress : tx.fromAddress;

    if (counterUser) {
      return {
        kind: 'USER' as const,
        userId: counterUser.id,
        address: counterUser.walletAddress,
        shortAddress: shortAddr(counterUser.walletAddress),
        basename: counterUser.basename,
        displayName: counterUser.displayName,
        avatarUrl: counterUser.avatarUrl,
      };
    }

    return {
      kind: 'EXTERNAL' as const,
      address: counterAddress,
      shortAddress: shortAddr(counterAddress),
      basename: null,
      displayName: null,
      avatarUrl: null,
    };
  }
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
