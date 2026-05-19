import { Injectable } from '@nestjs/common';
import { TxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_CONTACTS = 12;
const SCAN_LIMIT = 100;

export type Contact = {
  userId: string;
  walletAddress: string;
  basename: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastTxAt: Date;
};

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recent counterparties derived from the user's last N transfers. Skips
   * treasury rows and external addresses (no Kite user record yet).
   */
  async listForUser(viewerId: string): Promise<{ items: Contact[] }> {
    const txs = await this.prisma.transaction.findMany({
      where: {
        txType: TxType.TRANSFER,
        OR: [{ fromUserId: viewerId }, { toUserId: viewerId }],
      },
      orderBy: { createdAt: 'desc' },
      take: SCAN_LIMIT,
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

    const seen = new Set<string>();
    const items: Contact[] = [];
    for (const tx of txs) {
      const other =
        tx.fromUserId === viewerId ? tx.toUser : tx.fromUser;
      if (!other || other.id === viewerId) continue;
      if (seen.has(other.id)) continue;
      seen.add(other.id);
      items.push({
        userId: other.id,
        walletAddress: other.walletAddress,
        basename: other.basename,
        displayName: other.displayName,
        avatarUrl: other.avatarUrl,
        lastTxAt: tx.createdAt,
      });
      if (items.length >= MAX_CONTACTS) break;
    }
    return { items };
  }
}
