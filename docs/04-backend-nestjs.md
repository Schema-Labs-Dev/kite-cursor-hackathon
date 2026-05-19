# 04 — NestJS Backend

## Module map

```
apps/api/src/
├── main.ts                   # bootstrap, CORS, global pipes
├── app.module.ts             # root module wiring
├── config/
│   └── config.module.ts      # @nestjs/config + zod validation
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts     # PrismaClient as injectable
├── chain/
│   ├── chain.module.ts
│   ├── viem.service.ts       # viem public/wallet clients
│   └── abis/
│       └── kite-treasury.ts  # imported ABI
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts    # POST /auth/nonce, POST /auth/verify
│   ├── auth.service.ts       # SIWE verify, JWT issue
│   ├── jwt.strategy.ts
│   └── jwt-auth.guard.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts   # GET /me, PATCH /me
│   └── users.service.ts
├── contacts/
│   ├── contacts.module.ts
│   ├── contacts.controller.ts
│   └── contacts.service.ts
├── transactions/
│   ├── transactions.module.ts
│   ├── transactions.controller.ts  # GET /transactions, GET /transactions/:id
│   ├── transactions.service.ts
│   └── indexer.service.ts          # listens to USDC + Treasury events
├── treasury/
│   ├── treasury.module.ts
│   ├── treasury.controller.ts      # GET /treasury/balance, GET /treasury/yield
│   └── treasury.service.ts
├── basenames/
│   ├── basenames.module.ts
│   ├── basenames.controller.ts     # GET /basenames/resolve/:name
│   └── basenames.service.ts
└── webhooks/
    ├── webhooks.module.ts
    └── onramp.controller.ts        # POST /webhooks/onramp
```

## Dependencies

```bash
cd apps/api

pnpm add @nestjs/config @nestjs/jwt @nestjs/passport \
         @prisma/client passport passport-jwt \
         viem siwe zod
pnpm add -D prisma @types/passport-jwt
```

## Bootstrap (`main.ts`)

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:8081', 'exp://*'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  app.setGlobalPrefix('api/v1');

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

## Config validation (`config/config.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfig } from '@nestjs/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  BASE_SEPOLIA_RPC_URL: z.string().url(),
  KITE_TREASURY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  USDC_ADDRESS_BASE_SEPOLIA: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

@Module({
  imports: [
    NestConfig.forRoot({
      isGlobal: true,
      validate: (raw) => envSchema.parse(raw),
    }),
  ],
})
export class ConfigModule {}
```

## Viem service (`chain/viem.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, PublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';

@Injectable()
export class ViemService {
  readonly publicClient: PublicClient;

  constructor(private readonly config: ConfigService) {
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(this.config.get('BASE_SEPOLIA_RPC_URL')),
    });
  }
}
```

## Auth service — SIWE verification

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SiweMessage } from 'siwe';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private nonces = new Map<string, { nonce: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  generateNonce(address: string): string {
    const nonce = randomBytes(16).toString('hex');
    this.nonces.set(address.toLowerCase(), {
      nonce,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return nonce;
  }

  async verify(message: string, signature: string) {
    const siwe = new SiweMessage(message);
    const result = await siwe.verify({ signature });
    if (!result.success) throw new UnauthorizedException('Invalid signature');

    const address = siwe.address.toLowerCase();
    const stored = this.nonces.get(address);
    if (!stored || stored.nonce !== siwe.nonce || stored.expiresAt < Date.now()) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }
    this.nonces.delete(address);

    let user = await this.prisma.user.findUnique({ where: { walletAddress: address } });
    if (!user) {
      user = await this.prisma.user.create({ data: { walletAddress: address } });
    }

    const token = await this.jwt.signAsync({ sub: user.id, address });
    return { token, user };
  }
}
```

## Indexer service — pulling chain state into Postgres

A simple polling indexer that watches USDC `Transfer` and `KiteTreasury` events, then writes them into the `Transaction` table. NestJS lifecycle hook starts it.

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ViemService } from '../chain/viem.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseAbiItem, getAddress } from 'viem';

const USDC_TRANSFER = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly log = new Logger(IndexerService.name);
  private lastIndexed = 0n;

  constructor(
    private readonly viem: ViemService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    this.lastIndexed = await this.viem.publicClient.getBlockNumber();
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async tick() {
    const latest = await this.viem.publicClient.getBlockNumber();
    if (latest <= this.lastIndexed) return;

    const usdc = getAddress(this.config.get('USDC_ADDRESS_BASE_SEPOLIA')!);
    const logs = await this.viem.publicClient.getLogs({
      address: usdc,
      event: USDC_TRANSFER,
      fromBlock: this.lastIndexed + 1n,
      toBlock: latest,
    });

    for (const l of logs) {
      const from = l.args.from!.toLowerCase();
      const to = l.args.to!.toLowerCase();
      // Only persist tx if either party is a known Kite user
      const known = await this.prisma.user.findFirst({
        where: { walletAddress: { in: [from, to] } },
      });
      if (!known) continue;

      await this.prisma.transaction.upsert({
        where: { txHash: l.transactionHash },
        create: {
          txHash: l.transactionHash,
          fromAddress: from,
          toAddress: to,
          amount: l.args.value!.toString(),
          token: 'USDC',
          blockNumber: Number(l.blockNumber),
          status: 'CONFIRMED',
        },
        update: {},
      });
    }

    this.lastIndexed = latest;
    if (logs.length) this.log.log(`Indexed ${logs.length} USDC transfers`);
  }
}
```

Install scheduler:

```bash
pnpm add @nestjs/schedule
```

Register in `app.module.ts`:

```typescript
import { ScheduleModule } from '@nestjs/schedule';
// imports: [ScheduleModule.forRoot(), ...]
```

## Treasury service — reading onchain state

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ViemService } from '../chain/viem.service';
import { kiteTreasuryAbi } from '../chain/abis/kite-treasury';

@Injectable()
export class TreasuryService {
  constructor(
    private readonly viem: ViemService,
    private readonly config: ConfigService,
  ) {}

  async balanceOf(address: `0x${string}`) {
    const balance = await this.viem.publicClient.readContract({
      address: this.config.get('KITE_TREASURY_ADDRESS') as `0x${string}`,
      abi: kiteTreasuryAbi,
      functionName: 'balanceOf',
      args: [address],
    });
    return balance.toString(); // wei-like string, USDC has 6 decimals
  }

  async pendingYield(address: `0x${string}`) {
    const y = await this.viem.publicClient.readContract({
      address: this.config.get('KITE_TREASURY_ADDRESS') as `0x${string}`,
      abi: kiteTreasuryAbi,
      functionName: 'pendingYield',
      args: [address],
    });
    return y.toString();
  }
}
```

## Run order

```bash
# Terminal 1 — Postgres
docker compose up -d

# Terminal 2 — backend
cd apps/api
pnpm prisma migrate dev      # see 05-database-prisma.md
pnpm start:dev               # listening on :3001
```

Health check:

```bash
curl http://localhost:3001/api/v1/health
# → { "status": "ok" }
```

Move on to [`05-database-prisma.md`](./05-database-prisma.md) for the full Prisma schema.
