import { Module } from '@nestjs/common';
import { ChainModule } from '../chain/chain.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IndexerService } from './indexer.service';

@Module({
  imports: [PrismaModule, ChainModule],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
