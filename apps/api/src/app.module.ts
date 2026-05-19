import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { BasenamesModule } from './basenames/basenames.module';
import { ChainModule } from './chain/chain.module';
import { ContactsModule } from './contacts/contacts.module';
import { HealthModule } from './health/health.module';
import { IndexerModule } from './indexer/indexer.module';
import { OnrampModule } from './onramp/onramp.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TreasuryModule } from './treasury/treasury.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { validateEnv } from './config/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    ChainModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TreasuryModule,
    TransactionsModule,
    IndexerModule,
    BasenamesModule,
    ContactsModule,
    OnrampModule,
    WebhooksModule,
  ],
})
export class AppModule {}
