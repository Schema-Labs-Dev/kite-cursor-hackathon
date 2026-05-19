#!/usr/bin/env node
/**
 * End-to-end proof of indexer + transactions feed:
 *  - There's a USDC test bot on Base Sepolia at 0x2e0c... that self-transfers
 *    every few seconds. We tag it as a Kite user.
 *  - Wait for the indexer to pick up at least one new transfer.
 *  - Verify the persisted Transaction has fromUserId/toUserId linked.
 *  - Clean up.
 */
import { PrismaClient } from '@prisma/client';

const BOT_ADDRESS = '0x2e0c37b721124e2558baf75f6f8e6cc9f14aec29';
const TICK_MS = 6_000;
const MAX_WAIT_TICKS = 5;

const prisma = new PrismaClient();
const userId = `e2e-${Date.now()}`;

await prisma.user.create({
  data: {
    id: userId,
    walletAddress: BOT_ADDRESS,
    displayName: 'USDC Self-Transfer Bot',
  },
});
console.log(`Created Kite user for bot ${BOT_ADDRESS} (id=${userId})`);

const baselineCount = await prisma.transaction.count({
  where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
});
console.log(`Baseline linked txs: ${baselineCount}`);

let linked = [];
for (let i = 0; i < MAX_WAIT_TICKS; i++) {
  await new Promise((r) => setTimeout(r, TICK_MS + 500));
  linked = await prisma.transaction.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  if (linked.length > baselineCount) break;
  process.stdout.write('.');
}
console.log('');

if (linked.length === 0) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  throw new Error('No new transactions linked to the bot user within timeout');
}

console.log(`Indexer linked ${linked.length} transactions to the bot user:`);
for (const tx of linked.slice(0, 3)) {
  console.log(
    `  block ${tx.blockNumber}  ${tx.txHash.slice(0, 14)}...  ` +
      `${tx.txType}  amount=${tx.amount}  fromUserId=${tx.fromUserId}  toUserId=${tx.toUserId}`,
  );
}

await prisma.transaction.deleteMany({
  where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
});
await prisma.user.delete({ where: { id: userId } });
console.log('Cleaned up E2E user + transactions.');

await prisma.$disconnect();
