# 05 — Database & Prisma

## Setup

```bash
cd apps/api
pnpm dlx prisma init --datasource-provider postgresql
```

This creates `apps/api/prisma/schema.prisma`. Replace its contents with the schema below.

## Schema (`apps/api/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String   @id @default(cuid())
  walletAddress   String   @unique // lowercase 0x...
  basename        String?  @unique // e.g. alice.base.eth
  displayName     String?
  email           String?  @unique
  phone           String?  @unique
  avatarUrl       String?
  pushToken       String?  // Expo push token for notifications

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  contactsOwned   Contact[]      @relation("ContactOwner")
  contactsAs      Contact[]      @relation("ContactTarget")
  txsSent         Transaction[]  @relation("TxSender")
  txsReceived     Transaction[]  @relation("TxRecipient")
  notifications   Notification[]
  invitesSent     Invite[]

  @@index([walletAddress])
  @@index([basename])
}

model Contact {
  id            String   @id @default(cuid())
  ownerId       String
  owner         User     @relation("ContactOwner", fields: [ownerId], references: [id])

  // Contact may or may not be a Kite user yet
  contactId     String?
  contact       User?    @relation("ContactTarget", fields: [contactId], references: [id])

  // For non-Kite contacts, store an address or phone instead
  address       String?
  phone         String?
  nickname      String

  createdAt     DateTime @default(now())

  @@unique([ownerId, address])
  @@unique([ownerId, contactId])
  @@index([ownerId])
}

model Transaction {
  id            String   @id @default(cuid())
  txHash        String   @unique
  fromAddress   String
  toAddress     String

  fromUserId    String?
  fromUser      User?    @relation("TxSender", fields: [fromUserId], references: [id])
  toUserId      String?
  toUser        User?    @relation("TxRecipient", fields: [toUserId], references: [id])

  amount        String   // raw token units, USDC has 6 decimals — store as string for bigint safety
  token         String   // 'USDC' for now
  txType        TxType   @default(TRANSFER)

  memo          String?
  blockNumber   Int
  status        TxStatus @default(CONFIRMED)

  createdAt     DateTime @default(now())

  @@index([fromAddress])
  @@index([toAddress])
  @@index([fromUserId])
  @@index([toUserId])
  @@index([createdAt])
}

enum TxType {
  TRANSFER       // peer-to-peer USDC send
  TREASURY_DEPOSIT
  TREASURY_WITHDRAW
}

enum TxStatus {
  PENDING
  CONFIRMED
  FAILED
}

model Notification {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])

  type        String   // 'TX_RECEIVED', 'TX_SENT', 'INVITE_CLAIMED', etc.
  payload     Json
  readAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([userId, readAt])
}

model Invite {
  id            String       @id @default(cuid())
  senderId      String
  sender        User         @relation(fields: [senderId], references: [id])

  // Invite is for a phone or email recipient who isn't on Kite yet
  recipientPhone String?
  recipientEmail String?

  amount        String       // pending USDC amount in 6-decimal units
  status        InviteStatus @default(PENDING)
  claimToken    String       @unique // sent via SMS/email link
  expiresAt     DateTime

  createdAt     DateTime     @default(now())
  claimedAt     DateTime?

  @@index([senderId])
  @@index([recipientPhone])
  @@index([recipientEmail])
}

enum InviteStatus {
  PENDING
  CLAIMED
  EXPIRED
  CANCELLED
}
```

## First migration

```bash
cd apps/api
pnpm prisma migrate dev --name init
```

This creates `apps/api/prisma/migrations/<timestamp>_init/migration.sql` and applies it to your local Postgres. Commit the migrations folder.

## PrismaService

`apps/api/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

`apps/api/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

## Seed data (optional, but useful for the demo)

`apps/api/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Two demo users for the live send demo
  await prisma.user.upsert({
    where: { walletAddress: '0xdemo1...'.toLowerCase() },
    update: {},
    create: {
      walletAddress: '0xdemo1...'.toLowerCase(),
      basename: 'alice.base.eth',
      displayName: 'Alice',
    },
  });

  await prisma.user.upsert({
    where: { walletAddress: '0xdemo2...'.toLowerCase() },
    update: {},
    create: {
      walletAddress: '0xdemo2...'.toLowerCase(),
      basename: 'bernard.base.eth',
      displayName: 'Bernard',
    },
  });
}

main().finally(() => prisma.$disconnect());
```

Wire it up in `apps/api/package.json`:

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Run:

```bash
pnpm prisma db seed
```

## Why these tables?

| Table | Why |
|---|---|
| `User` | Maps wallet addresses to friendly profile data. Indexed by `walletAddress` and `basename` for fast lookups. |
| `Contact` | Address book. Supports both Kite users and non-users (so you can save a phone number that isn't onboarded yet). |
| `Transaction` | Cached view of onchain activity, enriched with memos and user relationships. The indexer fills this. |
| `Notification` | Inbox for the mobile app. Push fanout reads from here. |
| `Invite` | A pending USDC send to a phone/email that isn't a Kite user yet. They claim it via a magic link. |

## What's NOT in the database

- Balances — read directly from the chain via `TreasuryService` and USDC ERC-20
- Private keys — never. Smart Wallet handles all keys client-side via passkeys.
- Yield amounts — computed onchain by `KiteTreasury.balanceOf()`

Move on to [`06-api-spec.md`](./06-api-spec.md).
