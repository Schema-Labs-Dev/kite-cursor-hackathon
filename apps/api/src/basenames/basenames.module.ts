import { Module } from '@nestjs/common';
import { ChainModule } from '../chain/chain.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BasenamesController } from './basenames.controller';
import { BasenamesService } from './basenames.service';

@Module({
  imports: [PrismaModule, ChainModule],
  controllers: [BasenamesController],
  providers: [BasenamesService],
})
export class BasenamesModule {}
